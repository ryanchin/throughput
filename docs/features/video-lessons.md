# Feature: Video Lessons

**Status:** Complete
**Zone:** admin + shared
**Last Updated:** 2026-03-12

## Purpose
Cloudflare Stream integration for video upload and playback in lessons. Admins upload videos directly to Cloudflare Stream from the block editor via TUS protocol. Learners watch videos using signed playback URLs. Videos are embedded as custom Tiptap blocks in the lesson editor.

## User Stories
- As an admin, I can upload a video to a lesson via drag-and-drop or the /video slash command
- As an admin, I see upload progress and transcoding status in the editor
- As an admin, I can set a title for each video block
- As an admin, I can delete videos from Cloudflare Stream
- As a learner, I can watch lesson videos in the embedded player with signed URLs
- As a system, I prevent publishing lessons with videos still transcoding

## Acceptance Criteria
- [x] POST /api/admin/video/upload-url — returns Direct Creator Upload URL from Cloudflare Stream
- [x] GET /api/admin/video/status/[uid] — polls transcoding status
- [x] DELETE /api/admin/video/[uid] — deletes video from Stream (admin only)
- [x] GET /api/video/signed/[uid] — generates signed playback URL (authenticated users, 4h TTL)
- [x] Signed URL generation utility with RSA-SHA256 JWT token
- [x] VideoBlock Tiptap extension with /video slash command
- [x] Upload zone: drag-and-drop + file picker
- [x] TUS upload with progress bar (0–100%)
- [x] Transcoding status polling with "Processing video…" state
- [x] Video thumbnail preview once ready
- [x] Learner view: Cloudflare Stream iframe player with signed URL
- [x] Video title input below upload zone
- [x] Block stores: { videoId, title, duration }
- [x] Unit tests for signed URL generation, VideoNode extension, and VideoBlock component
- [x] Integration tests for all 4 API routes with auth checks
- [x] E2E tests for upload flow and player rendering

## Technical Notes
- API routes: `app/api/admin/video/` and `app/api/video/signed/`
- Cloudflare Stream API: `https://api.cloudflare.com/client/v4/accounts/{account_id}/stream`
- Direct Creator Upload via TUS protocol using `tus-js-client`
- Signed URLs generated server-side with RSA-SHA256 JWT using `CLOUDFLARE_STREAM_SIGNING_KEY`
- Video metadata (title, duration, thumbnail) lives in Cloudflare Stream, not our DB
- `video_ids` column on lessons table already exists for tracking
- VideoNode uses DOM-based node views (not React) for editor integration
- Falls back to unsigned iframe URL when signing keys are not configured (dev mode)

## Test Coverage
- Unit: `tests/unit/lib/video/signed-url.test.ts` — signed URL generation (JWT structure, RS256 header, payload, TTL, env var checks), getPlaybackUrl, getIframeUrl (12 tests)
- Unit: `tests/unit/editor/video-node.test.ts` — VideoNode extension config, attributes, parsing (10 tests)
- Unit: `tests/unit/components/editor/VideoBlock.test.tsx` — VideoBlock learner component rendering (7 tests)
- Integration: `tests/integration/admin/video-routes.test.ts` — all 4 API routes: upload-url, status, delete, signed (28 tests: auth, env vars, Cloudflare responses, error handling)
- E2E: `tests/e2e/admin/video-upload.spec.ts` — dropzone, uploading, processing, ready, error states, state switching (34 tests)

## Known Limitations / Future Work
- No video trimming or editing in-browser
- No batch upload for multiple videos
- Cloudflare Stream has no free tier ($5/month minimum)
- Public cert track videos use unsigned URLs (not implemented in this feature)
