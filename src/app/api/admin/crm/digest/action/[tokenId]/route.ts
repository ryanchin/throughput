import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { escapeHtml } from '@/lib/crm/digest-email'

interface RouteParams {
  params: Promise<{ tokenId: string }>
}

/**
 * GET /api/admin/crm/digest/action/[tokenId]
 * Action link handler for digest email one-click actions.
 *
 * - Simple actions (mark_complete): applies the mutation, returns success HTML page.
 * - View actions: redirects to the entity page with ?from=digest param.
 * - Invalid/expired tokens: returns styled error HTML page.
 *
 * Uses service client since tokens prove identity (no user session needed for mutations).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { tokenId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  // Look up the token
  const { data: token, error: tokenError } = await supabase
    .from('crm_action_tokens')
    .select('*')
    .eq('id', tokenId)
    .single()

  if (tokenError || !token) {
    return new NextResponse(buildErrorPage('Token Not Found', 'This action link is invalid or has already been used.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Validate: not used, not expired
  if (token.used) {
    return new NextResponse(buildErrorPage('Already Used', 'This action has already been completed.'), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const now = new Date()
  if (token.expires_at && new Date(token.expires_at) < now) {
    return new NextResponse(buildErrorPage('Expired', 'This action link has expired. Links are valid for 24 hours.'), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://throughput.aava.ai'

  // Handle action types
  if (token.action_type === 'mark_complete' && token.entity_type === 'task') {
    // Mark the task as completed
    const { error: updateError } = await supabase
      .from('crm_activities')
      .update({ status: 'Completed', completed: true })
      .eq('id', token.entity_id)

    if (updateError) {
      return new NextResponse(buildErrorPage('Action Failed', 'Could not complete this task. Please try again from the CRM.'), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Mark token as used
    await supabase
      .from('crm_action_tokens')
      .update({ used: true, clicked_at: now.toISOString() })
      .eq('id', tokenId)

    // Update clicked_items count on the most recent digest log for this user
    await supabase.rpc('increment_digest_clicks', { p_user_id: token.user_id }).catch(() => {
      // Non-critical: if the RPC doesn't exist, just update directly
      return supabase
        .from('crm_digest_logs')
        .update({ clicked_items: (token.clicked_items ?? 0) + 1 })
        .eq('user_id', token.user_id)
        .order('sent_at', { ascending: false })
        .limit(1)
    })

    return new NextResponse(buildSuccessPage('Task Completed', 'The task has been marked as complete.', baseUrl), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // For "view" actions, redirect to the entity page
  if (token.action_type === 'view') {
    // Mark token as used
    await supabase
      .from('crm_action_tokens')
      .update({ used: true, clicked_at: now.toISOString() })
      .eq('id', tokenId)

    const redirectUrl = getEntityUrl(baseUrl, token.entity_type, token.entity_id)
    return NextResponse.redirect(redirectUrl, 302)
  }

  // Unknown action type
  return new NextResponse(buildErrorPage('Unknown Action', 'This action type is not supported.'), {
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function getEntityUrl(baseUrl: string, entityType: string, entityId: string): string {
  switch (entityType) {
    case 'opportunity':
      return `${baseUrl}/admin/crm/opportunities/${entityId}?from=digest`
    case 'task':
      return `${baseUrl}/admin/crm/tasks?from=digest`
    case 'assignment':
      return `${baseUrl}/admin/crm/resources/rolloffs?from=digest`
    case 'role':
      return `${baseUrl}/admin/crm/resources/roles/${entityId}?from=digest`
    default:
      return `${baseUrl}/admin/crm?from=digest`
  }
}

function buildSuccessPage(title: string, message: string, baseUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#08090E;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;padding:40px;max-width:400px;">
    <div style="width:64px;height:64px;border-radius:50%;background-color:#052E20;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>
    <h1 style="font-size:22px;font-weight:700;color:#F0F2F8;margin:0 0 8px;">${escapeHtml(title)}</h1>
    <p style="font-size:14px;color:#8892A4;margin:0 0 24px;">${escapeHtml(message)}</p>
    <a href="${escapeHtml(baseUrl)}/admin/crm" style="display:inline-block;padding:10px 24px;background-color:#00D4FF;color:#08090E;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Open CRM</a>
  </div>
</body>
</html>`
}

function buildErrorPage(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#08090E;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;padding:40px;max-width:400px;">
    <div style="width:64px;height:64px;border-radius:50%;background-color:#2D0A0A;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
    </div>
    <h1 style="font-size:22px;font-weight:700;color:#F0F2F8;margin:0 0 8px;">${escapeHtml(title)}</h1>
    <p style="font-size:14px;color:#8892A4;margin:0;">${escapeHtml(message)}</p>
  </div>
</body>
</html>`
}
