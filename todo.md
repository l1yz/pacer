# TODO: Pacer App Improvements

## High Priority

### 🚨 Fix Batched API Calls Issue
**Problem**: When using batched calls to ReccoBeats API for Step 1 (getting track IDs), the response order doesn't match the request order, causing BPM values to be assigned to wrong tracks.

**Current Status**: 
- ✅ Individual calls work correctly (accurate BPM matching)
- ❌ Batched calls cause mismatched results
- 🔄 Temporarily using individual calls (slower but accurate)

**Root Cause**: 
```javascript
// In batched approach, this assumes same order:
features.forEach((feature, index) => {
  const spotifyId = validTracks[index].id;  // ❌ Wrong assumption!
  const reccoBeatId = feature.id;
  trackIdMapping.set(spotifyId, reccoBeatId);
});
```

**Potential Solutions**:
1. **Add response validation**: Check if ReccoBeats returns any identifier to match responses back to requests
2. **Implement fallback logic**: If batch results seem mismatched, fall back to individual calls
3. **Add track name/artist validation**: Compare returned metadata to detect mismatches
4. **Use smaller batch sizes**: Reduce from 40 to 5-10 tracks per batch to minimize impact
5. **Investigate ReccoBeats API docs**: Check if there's a way to ensure response order

**Performance Impact**:
- Individual calls: ~60 seconds for 100 tracks
- Batched calls: ~7.5 seconds for 100 tracks (but potentially wrong results)
- Target: Reliable batched calls in ~15-20 seconds

**Files to modify**:
- `app.js` lines 548-600 (Step 1 API calls)

### ✅ NEW: Batched Step 2 Option Added
**Feature**: Added optional batched calls for Step 2 (audio features retrieval)

**Current Status**:
- ✅ Individual Step 1 calls (accurate ID mapping)
- ✅ Individual Step 2 calls (current default - safe)
- ✅ Batched Step 2 calls (optional - faster)

**How to Enable Batched Step 2**:
```javascript
const USE_BATCH_STEP2 = true;  // Change from false to true
const BATCH_SIZE_STEP2 = 20;   // Adjustable batch size
```

**Theory**: Since Step 1 now uses individual calls and gets IDs in the correct order, Step 2 batched calls should maintain the same order and avoid mismatches.

**Performance Impact**:
- Individual Step 2: ~60 seconds for 100 tracks
- Batched Step 2: ~20-25 seconds for 100 tracks
- Still safer than batched Step 1 (which had the order issue)

**Safety Features**:
- Automatic fallback to individual calls if batch fails
- Batch size limit (20 tracks) to minimize impact of failures
- Detailed logging to detect any order mismatches

**Files Modified**:
- `app.js` lines 607-788 (Step 2 implementation with batch option)

---

## Medium Priority

### 🔧 Code Quality Improvements
- Fix TypeScript warnings:
  - Line 908: Unused `wasPlaying` variable
  - Lines 1199, 1400: `webkitAudioContext` property warnings

### 🎵 Feature Enhancements
- Add more playlist filtering options
- Improve BPM tolerance visualization
- Add export functionality for analyzed tracks

---

## Low Priority

### 📱 UI/UX Improvements
- Better loading states for playlist selection
- Progress indicators for long-running operations
- Dark/light mode toggle

---

## Testing Notes

**Current Working State**:
- ✅ Single song test: BPM retrieval accurate (148.1 BPM for "雨と僕の話")
- ✅ Individual API calls: No mismatch issues
- ✅ Playlist selection: Working correctly with dropdown

**To Test When Fixing Batched Calls**:
1. Create test playlist with 5-10 known songs
2. Compare individual vs batched results
3. Verify BPM values match expected values
4. Check for any order mismatches in logs