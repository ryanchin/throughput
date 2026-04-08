/**
 * Daily digest email template builder.
 * Pure function — no side effects, no DB access.
 * Returns a complete HTML email string with inline CSS.
 *
 * Security: All user-derived content is HTML-escaped to prevent XSS.
 */

export interface DigestItem {
  type: 'stale_deal' | 'overdue_task' | 'rolloff' | 'open_role'
  title: string
  subtitle: string
  detail: string
  actions: { label: string; tokenId: string }[]
}

export interface DigestData {
  userName: string
  items: DigestItem[]
  baseUrl: string
}

/** Escape HTML special characters to prevent XSS in email templates */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const TYPE_LABELS: Record<DigestItem['type'], string> = {
  stale_deal: 'Stale Deal',
  overdue_task: 'Overdue Task',
  rolloff: 'Upcoming Rolloff',
  open_role: 'Open Role',
}

const TYPE_COLORS: Record<DigestItem['type'], string> = {
  stale_deal: '#EF4444',
  overdue_task: '#F59E0B',
  rolloff: '#F59E0B',
  open_role: '#00D4FF',
}

function buildItemHtml(item: DigestItem, baseUrl: string): string {
  const color = TYPE_COLORS[item.type]
  const label = TYPE_LABELS[item.type]

  const actionsHtml = item.actions
    .map(
      (a) =>
        `<a href="${escapeHtml(baseUrl)}/api/admin/crm/digest/action/${escapeHtml(a.tokenId)}" style="display:inline-block;padding:8px 16px;background-color:#00D4FF;color:#08090E;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px;margin-right:8px;margin-top:8px;">${escapeHtml(a.label)}</a>`
    )
    .join('')

  return `
    <div style="background-color:#0F1117;border:1px solid #252D3D;border-radius:12px;padding:16px 20px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <span style="display:inline-block;padding:2px 8px;background-color:${color}22;color:${color};font-size:11px;font-weight:600;border-radius:4px;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(label)}</span>
      </div>
      <div style="font-size:15px;font-weight:600;color:#F0F2F8;margin-bottom:4px;">${escapeHtml(item.title)}</div>
      <div style="font-size:13px;color:#8892A4;margin-bottom:4px;">${escapeHtml(item.subtitle)}</div>
      <div style="font-size:12px;color:#4A5568;margin-bottom:8px;">${escapeHtml(item.detail)}</div>
      ${actionsHtml ? `<div style="margin-top:4px;">${actionsHtml}</div>` : ''}
    </div>
  `
}

export function buildDigestEmail(data: DigestData): string {
  const { userName, items, baseUrl } = data

  if (items.length === 0) {
    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#08090E;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:20px;font-weight:700;color:#F0F2F8;">Throughput CRM</div>
      <div style="font-size:12px;color:#8892A4;margin-top:4px;">Daily Digest</div>
    </div>
    <div style="background-color:#0F1117;border:1px solid #252D3D;border-radius:12px;padding:32px;text-align:center;">
      <div style="font-size:32px;margin-bottom:12px;">&#10003;</div>
      <div style="font-size:18px;font-weight:600;color:#F0F2F8;margin-bottom:8px;">All clear, ${escapeHtml(userName)}!</div>
      <div style="font-size:14px;color:#8892A4;">No items need attention today. Nice work keeping things current.</div>
    </div>
    <div style="text-align:center;margin-top:24px;font-size:11px;color:#4A5568;">
      <a href="${escapeHtml(baseUrl)}/admin/crm" style="color:#00D4FF;text-decoration:none;">Open CRM</a>
      &nbsp;&middot;&nbsp;
      <a href="${escapeHtml(baseUrl)}/admin/crm/settings/digest" style="color:#8892A4;text-decoration:none;">Manage preferences</a>
    </div>
  </div>
</body>
</html>`
  }

  // Group items by type
  const grouped: Record<string, DigestItem[]> = {}
  for (const item of items) {
    if (!grouped[item.type]) grouped[item.type] = []
    grouped[item.type].push(item)
  }

  const sectionOrder: DigestItem['type'][] = ['stale_deal', 'overdue_task', 'rolloff', 'open_role']
  const sectionsHtml = sectionOrder
    .filter((type) => grouped[type]?.length)
    .map((type) => {
      const sectionItems = grouped[type]
      const sectionLabel = TYPE_LABELS[type] + (sectionItems.length > 1 ? 's' : '')
      const itemsHtml = sectionItems.map((item) => buildItemHtml(item, baseUrl)).join('')
      return `
        <div style="margin-bottom:24px;">
          <div style="font-size:13px;font-weight:600;color:#8892A4;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">${escapeHtml(sectionLabel)} (${sectionItems.length})</div>
          ${itemsHtml}
        </div>
      `
    })
    .join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#08090E;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:20px;font-weight:700;color:#F0F2F8;">Throughput CRM</div>
      <div style="font-size:12px;color:#8892A4;margin-top:4px;">Daily Digest</div>
    </div>
    <div style="margin-bottom:24px;">
      <div style="font-size:16px;color:#F0F2F8;">Good morning, ${escapeHtml(userName)}</div>
      <div style="font-size:14px;color:#8892A4;margin-top:4px;">You have <strong style="color:#00D4FF;">${items.length}</strong> item${items.length === 1 ? '' : 's'} that need${items.length === 1 ? 's' : ''} attention today.</div>
    </div>
    ${sectionsHtml}
    <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #252D3D;">
      <a href="${escapeHtml(baseUrl)}/admin/crm/briefing" style="display:inline-block;padding:10px 24px;background-color:#00D4FF;color:#08090E;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Open Briefing</a>
    </div>
    <div style="text-align:center;margin-top:16px;font-size:11px;color:#4A5568;">
      <a href="${escapeHtml(baseUrl)}/admin/crm" style="color:#00D4FF;text-decoration:none;">Open CRM</a>
      &nbsp;&middot;&nbsp;
      <a href="${escapeHtml(baseUrl)}/admin/crm/settings/digest" style="color:#8892A4;text-decoration:none;">Manage preferences</a>
    </div>
  </div>
</body>
</html>`
}
