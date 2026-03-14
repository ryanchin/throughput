# Feature: Video Lessons

**Status:** Complete
**Zone:** admin + shared
**Last Updated:** 2026-03-13

## Purpose
Bunny.net Stream integration for video upload and playback in lessons. Admins upload videos directly to Bunny.net Stream from the block editor via PUT request. Learners watch videos using signed playback URLs (HMAC-SHA256 token auth). Videos are embedded as custom Tiptap blocks in the lesson editor.

## User Stories
- As an admin, I can upload a video to a lesson via drag-and-drop or the /video slash command
- As an admin, I see upload progress and transcoding status in the editor
- As an admin, I can set a title for each video block
- As an admin, I can delete videos from Bunny.net Stream
- As a learner, I can watch lesson videos in the embedded player with signed URLs
- As a system, I prevent publishing lessons with videos still transcoding

## Acceptance Criteria
- [x] POST /api/admin/video/upload-url — creates video in Bunny.net Stream, returns PUT upload URL + auth key
- [x] GET /api/admin/video/status/[uid] — polls transcoding status (status codes: 0-5)
- [x] DELETE /api/admin/video/[uid] — deletes video from Stream (admin only)
- [x] GET /api/video/signed/[uid] — generates signed playback URL (authenticated users, 4h TTL)
- [x] Signed URL generation utility with HMAC-SHA256 token
- [x] VideoBlock Tiptap extension with /video slash command
- [x] Upload zone: drag-and-drop + file picker
- [x] PUT upload with progress bar (0-100%) via XMLHttpRequest
- [x] Transcoding status polling with "Processing video..." state
- [x] Video thumbnail preview once ready (via CDN hostname)
- [x] Learner view: Bunny.net Stream iframe player with signed URL
- [x] Video title input below upload zone
- [x] Block stores: { videoId, title, duration }
- [x] Unit tests for signed URL generation, VideoNode extension, and VideoBlock component
- [x] Integration tests for all 4 API routes with auth checks
- [x] E2E tests for upload flow and player rendering

## Technical Notes
- API routes: `app/api/admin/video/` and `app/api/video/signed/`
- Bunny.net Stream API: `https://video.bunnycdn.com/library/{libraryId}/videos`
- Upload: server creates video entry, returns PUT URL + AccessKey; client PUTs file directly to Bunny.net
- Signed URLs generated server-side with SHA-256 hash of (tokenSecret + videoId + expiryTimestamp)
- Playback via iframe embed: `https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}`
- Video metadata (title, duration, thumbnail) lives in Bunny.net Stream, not our DB
- Thumbnails served via CDN: `https://{BUNNY_STREAM_CDN_HOSTNAME}/{videoId}/{thumbnailFileName}`
- `video_ids` column on lessons table already exists for tracking
- VideoNode uses DOM-based node views (not React) for editor integration
- Falls back to unsigned iframe URL when signing keys are not configured (dev mode)
- Bunny.net status codes: 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error
- Env vars: BUNNY_STREAM_API_KEY, BUNNY_STREAM_LIBRARY_ID, NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_CDN_HOSTNAME, BUNNY_STREAM_TOKEN_SECRET

## Test Coverage
- Unit: `tests/unit/lib/video/signed-url.test.ts` — signed URL generation (SHA-256 hash, token format, TTL, env var checks), getPlaybackUrl, getIframeUrl
- Unit: `tests/unit/editor/video-node.test.ts` — VideoNode extension config, attributes, parsing
- Unit: `tests/unit/components/editor/VideoBlock.test.tsx` — VideoBlock learner component rendering
- Integration: `tests/integration/admin/video-routes.test.ts` — all 4 API routes: upload-url, status, delete, signed (auth, env vars, Bunny.net responses, error handling)
- E2E: `tests/e2e/admin/video-upload.spec.ts` — dropzone, uploading, processing, ready, error states, state switching

## Known Limitations / Future Work
- No video trimming or editing in-browser
- No batch upload for multiple videos
- Bunny.net Stream is usage-based (~$1-3/month for small internal use)
- Public cert track videos use unsigned URLs (not implemented in this feature)
- Admin API key is passed to client for upload (acceptable since only admins can trigger upload-url route)
