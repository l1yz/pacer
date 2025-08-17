// ============= Configuration =============
//addDebugLog('VERSION STAMP', { build: 'getTracksWithBPM MAX_IDS=20 / single-ID fallback v3' });

const CLIENT_ID = '593a5515c27d4db4873b52036524e37c'; 
const REDIRECT_URI = 'https://l1yz.github.io/pacer';//'http://localhost:3000';
const SCOPES = [
    'user-read-private',
    'user-library-read',  // For Liked Songs access
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'streaming',          // For Web Playback SDK
    'user-read-playback-state',
    'user-modify-playback-state'
].join(' ');

// ============= Auth & Token Management =============
let accessToken = null;
let debugLog = []; // Store debug information

// Generate random string for state parameter
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Generate code verifier and challenge for PKCE
function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Handle login with PKCE
document.getElementById('login-button').addEventListener('click', async () => {
    const state = generateRandomString(16);
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    localStorage.setItem('spotify_auth_state', state);
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', SCOPES);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('code_challenge', codeChallenge);
    
    window.location.href = authUrl.toString();
});

// Check for authorization code in URL (after redirect)
function checkForToken() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('code')) {
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const storedState = localStorage.getItem('spotify_auth_state');
        
        if (state !== storedState) {
            alert('Authentication error. Please try again.');
            return;
        }
        
        exchangeCodeForToken(code);
    }
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                code_verifier: codeVerifier
            })
        });
        
        if (!response.ok) {
            throw new Error('Token exchange failed');
        }
        
        const data = await response.json();
        accessToken = data.access_token;
        
        // Clean up
        localStorage.removeItem('spotify_auth_state');
        localStorage.removeItem('spotify_code_verifier');
        window.history.replaceState(null, null, window.location.pathname);
        
        showApp();
        loadUserInfo();
        
    } catch (error) {
        console.error('Token exchange failed:', error);
        alert('Authentication failed. Please try again.');
    }
}

// ============= Debug Functions =============
function addDebugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        time: timestamp,
        message: message,
        data: data
    };
    debugLog.push(logEntry);
    
    // Update UI
    const debugContent = document.getElementById('debug-content');
    if (debugContent) {
        const logText = data ? 
            `[${timestamp}] ${message}\n${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}\n` : 
            `[${timestamp}] ${message}\n`;
        debugContent.textContent += logText;
        debugContent.scrollTop = debugContent.scrollHeight;
    }
    
    console.log(message, data);
}

function downloadDebugLog() {
    const csvContent = ['Track Name,Artist,BPM,Tempo Difference from Target'];
    
    if (window.analyzedTracks) {
        const targetBPM = parseInt(document.getElementById('target-bpm').value);
        window.analyzedTracks.forEach(track => {
            const tempo = track.tempo || 'N/A';
            const diff = tempo !== 'N/A' ? Math.abs(tempo - targetBPM).toFixed(1) : 'N/A';
            csvContent.push(`"${track.name}","${track.artists.map(a => a.name).join(', ')}",${tempo},${diff}`);
        });
    }
    
    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bpm-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// ============= UI Management =============
function showApp() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    
    // Add debug output area if it doesn't exist
    if (!document.getElementById('debug-output')) {
        const debugDiv = document.createElement('div');
        debugDiv.id = 'debug-output';
        debugDiv.innerHTML = `
            <div style="margin-top: 20px; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 10px;">
                <h3 style="color: white;">Debug Output:</h3>
                <button id="download-debug" class="btn-small" style="margin-bottom: 10px;">Download CSV Report</button>
                <div id="debug-content" style="max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; white-space: pre-wrap; background: rgba(0,0,0,0.3); padding: 10px; color: #0f0;"></div>
            </div>
        `;
        document.getElementById('app-section').appendChild(debugDiv);
        
        // Add download functionality
        document.getElementById('download-debug').addEventListener('click', downloadDebugLog);
    }
}

function hideApp() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('app-section').classList.add('hidden');
}

// Logout
document.getElementById('logout-button').addEventListener('click', () => {
    accessToken = null;
    hideApp();
});

// ============= Spotify API Calls =============
// async function spotifyAPI(endpoint, method = 'GET', body = null) {
//     const options = {
//         method,
//         headers: {
//             'Authorization': `Bearer ${accessToken}`,
//             'Content-Type': 'application/json'
//         }
//     };
    
//     if (body) {
//         options.body = JSON.stringify(body);
//     }
    
//     const response = await fetch(`https://api.spotify.com/${endpoint}`, options);
    
//     if (!response.ok) {
//         // Get more details about the error
//         let errorDetails = `${response.status} ${response.statusText}`;
//         try {
//             const errorBody = await response.json();
//             if (errorBody.error) {
//                 errorDetails = `${response.status}: ${errorBody.error.message || response.statusText}`;
//             }
//         } catch (e) {
//             // If response isn't JSON, stick with basic error
//         }
//         throw new Error(`API call failed: ${errorDetails} for ${endpoint}`);
//     }
    
//     return response.json();
// }


// async function spotifyAPI(endpoint, method = 'GET', body = null) {
//   const headers = { Authorization: `Bearer ${accessToken}` };
//   if (body != null) headers['Content-Type'] = 'application/json';

//   const res = await fetch(`https://api.spotify.com/${endpoint}`, {
//     method,
//     headers,
//     ...(body != null ? { body: JSON.stringify(body) } : {})
//   });

//   if (!res.ok) {
//     // log real error text so we can see "Insufficient client scope", etc.
//     let msg = `${res.status}: ${res.statusText}`;
//     try {
//       const text = await res.text();
//       try {
//         const j = JSON.parse(text);
//         if (j.error?.message) msg = `${res.status}: ${j.error.message}`;
//       } catch { msg = `${res.status}: ${text.slice(0,200)}`; }
//     } catch {}
//     throw new Error(`API call failed: ${msg} for ${endpoint}`);
//   }
//   return res.json();
// }
async function spotifyAPI(endpoint, method = 'GET', body = null) {
  const url = `https://api.spotify.com/${endpoint}`;
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (body != null) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    ...(body != null ? { body: JSON.stringify(body) } : {}),
    mode: 'cors',
  });

  // read once, reuse
  const rawText = await res.clone().text();
  const contentType = res.headers.get('content-type') || '';
  const jsonMaybe = contentType.includes('application/json');

  if (!res.ok) {
    const parsed = jsonMaybe ? (() => { try { return JSON.parse(rawText); } catch { return null; } })() : null;
    const serverMsg = parsed?.error?.message || rawText || '(no body)';
    const errInfo = {
      method,
      endpoint,
      urlLength: url.length,
      status: res.status,
      statusText: res.statusText,
      serverMessage: serverMsg.slice(0, 500),
      respContentType: contentType,
      date: res.headers.get('date'),
      'x-spotify-trace-id': res.headers.get('x-spotify-trace-id'),
      'access-control-allow-origin': res.headers.get('access-control-allow-origin'),
      'x-cache': res.headers.get('x-cache'),
    };
    addDebugLog('API ERROR', errInfo);

    const err = new Error(`API call failed: ${res.status} ${res.statusText} - ${serverMsg}`);
    err.status = res.status;
    err.bodyText = serverMsg;
    throw err;
  }

  return jsonMaybe ? JSON.parse(rawText) : rawText;
}


// Load user info
async function loadUserInfo() {
    try {
        const user = await spotifyAPI('v1/me');
        document.getElementById('user-name').textContent = `Hello, ${user.display_name}!`;
        
        // Load playlists for the dropdown
        await loadPlaylistOptions();
        
        // Initialize Spotify Player after authentication
        if (typeof Spotify !== 'undefined') {
            await initializeSpotifyPlayer();
        } else {
            addDebugLog('Spotify Web Playback SDK not loaded yet. Will initialize when ready.');
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

// Load playlist options for the dropdown
async function loadPlaylistOptions() {
    try {
        const selector = document.getElementById('playlist-selector');
        
        // Clear loading option
        selector.innerHTML = '<option value="liked">Liked Songs</option>';
        
        addDebugLog('Loading playlists for dropdown...');
        const playlists = await getAllPlaylists();
        
        // Add each playlist as an option
        playlists.forEach(playlist => {
            const option = document.createElement('option');
            option.value = playlist.id;
            option.textContent = `${playlist.name} (${playlist.tracks?.total || '?'} tracks)`;
            selector.appendChild(option);
        });
        
        addDebugLog(`Loaded ${playlists.length} playlists into dropdown`);
        
    } catch (error) {
        addDebugLog(`Failed to load playlists: ${error.message}`);
        const selector = document.getElementById('playlist-selector');
        selector.innerHTML = '<option value="liked">Liked Songs</option><option disabled>Failed to load playlists</option>';
    }
}

// Get tracks from a specific playlist
async function getTracksFromPlaylist(playlistId) {
    const tracks = [];
    let offset = 0;
    let hasMore = true;
    
    addDebugLog(`Fetching tracks from playlist: ${playlistId}`);
    
    while (hasMore) {
        const response = await spotifyAPI(`v1/playlists/${playlistId}/tracks?limit=100&offset=${offset}`);
        
        // Filter out null tracks and extract the track objects
        const validTracks = response.items
            .filter(item => item.track && item.track.id)
            .map(item => item.track);
        
        tracks.push(...validTracks);
        hasMore = response.next !== null;
        offset += 100;
        
        addDebugLog(`Fetched ${tracks.length} tracks so far...`);
    }
    
    addDebugLog(`Total tracks from playlist: ${tracks.length}`);
    return tracks;
}

// ============= NEW: Get Liked Songs Function =============
async function getLikedSongs() {
    const tracks = [];
    let offset = 0;
    let hasMore = true;
    
    addDebugLog('Fetching Liked Songs...');
    
    while (hasMore) {
        const response = await spotifyAPI(`v1/me/tracks?limit=50&offset=${offset}`);
        tracks.push(...response.items.map(item => item.track));
        hasMore = response.next !== null;
        offset += 50;
        
        addDebugLog(`Fetched ${tracks.length} liked songs so far...`);
    }
    
    addDebugLog(`Total Liked Songs found: ${tracks.length}`);
    return tracks;
}

// ============= Main Analysis Function =============
document.getElementById('analyze-button').addEventListener('click', async () => {
    const targetBPM = parseInt(document.getElementById('target-bpm').value);
    const tolerance = parseInt(document.getElementById('tolerance').value);
    const selectedPlaylist = document.getElementById('playlist-selector').value;
    
    // Clear previous debug logs
    debugLog = [];
    if (document.getElementById('debug-content')) {
        document.getElementById('debug-content').textContent = '';
    }
    
    addDebugLog(`Starting analysis: Target BPM = ${targetBPM}, Tolerance = ±${tolerance}`);
    addDebugLog(`Selected playlist: ${selectedPlaylist === 'liked' ? 'Liked Songs' : selectedPlaylist}`);
    
    // Show progress
    document.getElementById('progress').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    
    try {
        let allTracks = [];
        
        if (selectedPlaylist === 'liked') {
            // Get Liked Songs
            updateProgress('Fetching your Liked Songs...', 20);
            allTracks = await getLikedSongs();
        } else {
            // Get tracks from selected playlist
            updateProgress('Fetching tracks from selected playlist...', 20);
            allTracks = await getTracksFromPlaylist(selectedPlaylist);
        }
        
        addDebugLog(`Total unique tracks to analyze: ${allTracks.length}`);
        
        // Get audio features for all tracks
        updateProgress('Analyzing BPM...', 60);
        const tracksWithBPM = await getTracksWithBPM(allTracks, targetBPM, tolerance);
        
        // Store for CSV export
        window.analyzedTracks = tracksWithBPM;
        
        // Filter tracks by BPM
        updateProgress('Finding matches...', 80);
        const matchingTracks = tracksWithBPM.filter(track => {
            if (!track.tempo) return false;
            const match = track.tempo >= targetBPM - tolerance && 
                          track.tempo <= targetBPM + tolerance;
            if (match) {
                addDebugLog(`✓ Match found: "${track.name}" by ${track.artists.map(a => a.name).join(', ')} - ${track.tempo.toFixed(1)} BPM`);
            }
            return match;
        });
        
        addDebugLog(`\nTotal matches found: ${matchingTracks.length} out of ${tracksWithBPM.length} tracks`);
        
        // Sort by closeness to target BPM
        matchingTracks.sort((a, b) => 
            Math.abs(a.tempo - targetBPM) - Math.abs(b.tempo - targetBPM)
        );
        
        // Show results
        updateProgress('Done!', 100);
        showResults(matchingTracks);
        
    } catch (error) {
        console.error('Analysis failed:', error);
        addDebugLog(`ERROR: ${error.message}`);
        alert('Failed to analyze music. Please try again.');
    }
    
    document.getElementById('progress').classList.add('hidden');
});

// Get all playlists (handling pagination)
async function getAllPlaylists() {
    const playlists = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
        const response = await spotifyAPI(`v1/me/playlists?limit=50&offset=${offset}`);
        playlists.push(...response.items);
        hasMore = response.next !== null;
        offset += 50;
    }
    
    addDebugLog(`Found ${playlists.length} playlists`);
    return playlists;
}

// Get all tracks from playlists
async function getAllTracksFromPlaylists(playlists) {
    const trackMap = new Map(); // Use Map to avoid duplicates
    
    for (const playlist of playlists) {
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
            const response = await spotifyAPI(
                `v1/playlists/${playlist.id}/tracks?limit=100&offset=${offset}`
            );
            
            for (const item of response.items) {
                if (item.track && item.track.id) {
                    trackMap.set(item.track.id, item.track);
                }
            }
            
            hasMore = response.next !== null;
            offset += 100;
        }
        
        addDebugLog(`Playlist "${playlist.name}": ${response.total} tracks`);
    }
    
    return Array.from(trackMap.values());
}


async function getTracksWithBPM(tracks, targetBPM, tolerance) {
  const tracksWithBPM = [];
  let noAudioFeatures = 0;
  let successCount = 0;

  // Use song limit from input for faster testing
  const songLimit = parseInt(document.getElementById('song-limit').value) || 100;
  const tracksToProcess = tracks.slice(0, songLimit);
  
  addDebugLog('--- Analyzing BPM using ReccoBeats two-step API ---');
  addDebugLog(`Processing first ${tracksToProcess.length} tracks out of ${tracks.length} total...`);

  // Use exact headers from official documentation
  const myHeaders = new Headers();
  myHeaders.append("Accept", "application/json");

  const requestOptions = {
    method: "GET",
    headers: myHeaders,
    redirect: "follow"
  };

  // STEP 1: Get ReccoBeats track IDs from Spotify IDs (individual calls)
  addDebugLog('=== STEP 1: Getting ReccoBeats track IDs ===');
  const trackIdMapping = new Map(); // spotifyId -> reccoBeatId
  
  for (let i = 0; i < tracksToProcess.length; i++) {
    const track = tracksToProcess[i];
    
    if (!track || !track.id) {
      addDebugLog(`❌ Invalid track at index ${i}`);
      continue;
    }

    try {
      // Clean the track ID - remove any spotify: prefix if present
      const trackId = track.id.replace('spotify:track:', '');
      
      // Create URL for individual track ID lookup
      const url = new URL('https://api.reccobeats.com/v1/audio-features');
      url.searchParams.append('ids', trackId);

      addDebugLog(`Getting ReccoBeats ID for "${track.name}" (${i + 1}/${tracksToProcess.length})`);

      const response = await fetch(url.toString(), requestOptions);
      
      if (!response.ok) {
        addDebugLog(`❌ ID lookup error for "${track.name}": ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const features = Array.isArray(data) ? data : (data.content || data.audio_features || data.features || []);
      
      if (features.length > 0 && features[0].id) {
        const reccoBeatId = features[0].id;
        trackIdMapping.set(track.id, reccoBeatId);
        addDebugLog(`✓ Mapped "${track.name}" -> ReccoBeats ID: ${reccoBeatId}`);
      } else {
        addDebugLog(`❌ No ReccoBeats ID found for "${track.name}"`);
      }

      // Add delay between individual calls
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      addDebugLog(`❌ Fetch error for "${track.name}": ${error.message}`);
    }

    // Update progress
    updateProgress(
      `Getting ReccoBeats IDs... (${i + 1}/${tracksToProcess.length} tracks)`,
      40 + (20 * (i + 1) / tracksToProcess.length)
    );
  }

  addDebugLog(`=== ID MAPPING COMPLETE: ${trackIdMapping.size} tracks mapped ===`);

  // STEP 2: Get detailed audio features using ReccoBeats IDs
  addDebugLog('=== STEP 2: Getting detailed audio features ===');
  
  // Option to use batch calls for Step 2 (set to false for safety, true for speed)
  const USE_BATCH_STEP2 = false;
  const BATCH_SIZE_STEP2 = 20;
  
  if (USE_BATCH_STEP2) {
    addDebugLog('Using BATCH mode for Step 2');
    await processBatchStep2();
  } else {
    addDebugLog('Using INDIVIDUAL mode for Step 2');
    await processIndividualStep2();
  }

  async function processBatchStep2() {
    // Get tracks that have ReccoBeats IDs
    const tracksWithIds = tracksToProcess.filter(track => 
      track && track.id && trackIdMapping.has(track.id)
    );
    
    for (let i = 0; i < tracksWithIds.length; i += BATCH_SIZE_STEP2) {
      const batch = tracksWithIds.slice(i, i + BATCH_SIZE_STEP2);
      const reccoIds = batch.map(track => trackIdMapping.get(track.id));
      
      try {
        // Create batch URL for audio features
        const url = new URL('https://api.reccobeats.com/v1/audio-features');
        url.searchParams.append('ids', reccoIds.join(','));
        
        addDebugLog(`Batch ${Math.floor(i/BATCH_SIZE_STEP2) + 1}: Getting features for ${batch.length} tracks`);
        addDebugLog(`Track names: ${batch.map(t => t.name).join(', ')}`);
        
        const response = await fetch(url.toString(), requestOptions);
        
        if (!response.ok) {
          addDebugLog(`❌ Batch features error: ${response.status} ${response.statusText}`);
          // Fall back to individual calls for this batch
          for (const track of batch) {
            await processIndividualTrack(track);
          }
          continue;
        }
        
        const data = await response.json();
        const features = Array.isArray(data) ? data : (data.content || data.audio_features || data.features || []);
        
        addDebugLog(`Got ${features.length} feature sets for ${batch.length} tracks`);
        
        // Process results - since Step 1 was individual, IDs should be in order
        features.forEach((audioFeature, index) => {
          if (index < batch.length) {
            const track = batch[index];
            processTrackFeatures(track, audioFeature);
          }
        });
        
        // Add delay between batches
        await new Promise(resolve => setTimeout(resolve, 800));
        
      } catch (error) {
        addDebugLog(`❌ Batch error: ${error.message}`);
        // Fall back to individual calls for this batch
        for (const track of batch) {
          await processIndividualTrack(track);
        }
      }
      
      // Update progress
      updateProgress(
        `Getting audio features (batch)... (${Math.min(i + BATCH_SIZE_STEP2, tracksWithIds.length)}/${tracksWithIds.length} tracks)`,
        60 + (20 * Math.min(i + BATCH_SIZE_STEP2, tracksWithIds.length) / tracksWithIds.length)
      );
    }
    
    // Handle tracks without ReccoBeats IDs
    for (const track of tracksToProcess) {
      if (!track || !track.id || !trackIdMapping.has(track.id)) {
        tracksWithBPM.push({ ...track, tempo: null });
        noAudioFeatures++;
        if (track && track.name) {
          addDebugLog(`❌ No ReccoBeats ID for "${track.name}"`);
        }
      }
    }
  }

  async function processIndividualStep2() {
    for (let i = 0; i < tracksToProcess.length; i++) {
      const track = tracksToProcess[i];
      await processIndividualTrack(track, i);
    }
  }

  async function processIndividualTrack(track, index = null) {
    if (!track || !track.id) {
      tracksWithBPM.push({ ...track, tempo: null });
      noAudioFeatures++;
      return;
    }

    const reccoBeatId = trackIdMapping.get(track.id);
    if (!reccoBeatId) {
      tracksWithBPM.push({ ...track, tempo: null });
      noAudioFeatures++;
      addDebugLog(`❌ No ReccoBeats ID found for "${track.name}"`);
      return;
    }

    try {
      // Use individual track endpoint with ReccoBeats ID
      const url = `https://api.reccobeats.com/v1/track/${reccoBeatId}/audio-features`;
      
      addDebugLog(`Fetching detailed features for "${track.name}" (ReccoBeats ID: ${reccoBeatId})`);
      
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        addDebugLog(`❌ Individual track error for "${track.name}": ${response.status} ${response.statusText}`);
        tracksWithBPM.push({ ...track, tempo: null });
        noAudioFeatures++;
        return;
      }

      const audioFeature = await response.json();
      addDebugLog(`✓ Got detailed features for "${track.name}":`, audioFeature);

      processTrackFeatures(track, audioFeature);

      // Add delay between individual calls
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      addDebugLog(`❌ Error fetching features for "${track.name}": ${error.message}`);
      tracksWithBPM.push({ ...track, tempo: null });
      noAudioFeatures++;
    }

    // Update progress if index provided
    if (index !== null) {
      const processed = index + 1;
      updateProgress(
        `Getting audio features... (${processed}/${tracksToProcess.length} tracks)`,
        60 + (20 * processed / tracksToProcess.length)
      );
    }
  }

  function processTrackFeatures(track, audioFeature) {
    // Check for track name/artist validation if available
    if (audioFeature.name && audioFeature.name !== track.name) {
      addDebugLog(`  🚨 NAME MISMATCH: Expected "${track.name}", got "${audioFeature.name}"`);
    }

    // Check for genre/style validation based on acousticness
    const isClassical = track.name.toLowerCase().includes('concerto') || 
                       track.name.toLowerCase().includes('symphony') || 
                       track.name.toLowerCase().includes('sonata') ||
                       track.artists.some(a => a.name.toLowerCase().includes('orchestra'));
                       
    const isPop = track.name.toLowerCase().includes('pop') ||
                 track.artists.some(a => a.name.toLowerCase().includes('pop'));
    
    if (isClassical && audioFeature.acousticness < 0.5) {
      addDebugLog(`  🚨 SUSPICIOUS: Classical track "${track.name}" has low acousticness: ${audioFeature.acousticness}`);
    }
    
    if (isPop && audioFeature.acousticness > 0.8) {
      addDebugLog(`  🚨 SUSPICIOUS: Pop track "${track.name}" has very high acousticness: ${audioFeature.acousticness}`);
    }

    const tempo = audioFeature?.tempo || audioFeature?.bpm || null;

    if (tempo && typeof tempo === 'number' && tempo > 0) {
      tracksWithBPM.push({ ...track, tempo: tempo });
      successCount++;
      const diff = Math.abs(tempo - targetBPM);
      const symbol = diff <= tolerance ? '✅' : '⭕';
      addDebugLog(`${symbol} "${track.name}" - ${tempo.toFixed(1)} BPM (diff: ${diff.toFixed(1)}) [acousticness: ${audioFeature.acousticness?.toFixed(3)}]`);
    } else {
      tracksWithBPM.push({ ...track, tempo: null });
      noAudioFeatures++;
      addDebugLog(`❌ No valid BPM for "${track.name}" (got: ${tempo})`);
    }
  }

  addDebugLog(`\n📊 Analysis Summary:`);
  addDebugLog(`- Tracks processed: ${tracksToProcess.length}`);
  addDebugLog(`- Tracks with BPM data: ${successCount}`);
  addDebugLog(`- Tracks without BPM data: ${noAudioFeatures}`);
  addDebugLog(`- Success rate: ${tracksToProcess.length > 0 ? (successCount/tracksToProcess.length*100).toFixed(1) : 0}%`);

  // Add remaining tracks as null tempo if user wants to see full list
  const remainingTracks = tracks.slice(songLimit);
  remainingTracks.forEach(track => {
    tracksWithBPM.push({ ...track, tempo: null });
  });

  return tracksWithBPM;
}

function updateProgress(text, percentage) {
    document.querySelector('.progress-text').textContent = text;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
}

// Show results
function showResults(tracks) {
    document.getElementById('track-count').textContent = tracks.length;
    
    const trackList = document.getElementById('track-list');
    trackList.innerHTML = '';
    
    // Show max 50 tracks in UI
    const displayTracks = tracks.slice(0, 50);
    
    displayTracks.forEach(track => {
        const trackElement = document.createElement('div');
        trackElement.className = 'track-item';
        trackElement.innerHTML = `
            <div>
                <div class="track-name">${track.name}</div>
                <div class="track-artist">${track.artists.map(a => a.name).join(', ')}</div>
                <div class="track-duration">${formatDuration(track.duration_ms || 180000)}</div>
            </div>
            <span class="track-bpm">${track.tempo.toFixed(3)} BPM</span>
        `;
        trackList.appendChild(trackElement);
    });
    
    document.getElementById('results').classList.remove('hidden');
    
    // Store tracks for playlist creation
    window.matchingTracks = tracks;
}

// Create duration-limited playlist
function createLimitedPlaylist(tracks, maxDurationMinutes) {
    const maxDurationMs = maxDurationMinutes * 60 * 1000;
    let currentDuration = 0;
    const selectedTracks = [];
    
    // Sort tracks by closeness to target BPM for best matches first
    const targetBPM = parseInt(document.getElementById('target-bpm').value);
    const sortedTracks = [...tracks].sort((a, b) => 
        Math.abs(a.tempo - targetBPM) - Math.abs(b.tempo - targetBPM)
    );
    
    for (const track of sortedTracks) {
        const trackDuration = track.duration_ms || 180000; // Default 3 minutes if no duration
        
        if (currentDuration + trackDuration <= maxDurationMs) {
            selectedTracks.push(track);
            currentDuration += trackDuration;
        }
        
        // Break if we're close to the limit
        if (currentDuration >= maxDurationMs * 0.95) break;
    }
    
    addDebugLog(`Playlist created: ${selectedTracks.length} tracks, ${formatDuration(currentDuration)} duration`);
    return selectedTracks;
}

// Format duration from milliseconds to MM:SS
function formatDuration(durationMs) {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Create playlist
document.getElementById('create-playlist').addEventListener('click', async () => {
    if (!window.matchingTracks || window.matchingTracks.length === 0) {
        alert('No tracks to add to playlist!');
        return;
    }
    
    try {
        // Get user ID
        const user = await spotifyAPI('v1/me');
        
        // Create playlist
        const targetBPM = document.getElementById('target-bpm').value;
        const playlist = await spotifyAPI(
            `v1/users/${user.id}/playlists`,
            'POST',
            {
                name: `🏃 ${targetBPM} BPM Running Mix`,
                description: `Generated by BPM Runner - ${window.matchingTracks.length} tracks around ${targetBPM} BPM`,
                public: false
            }
        );
        
        // Add tracks (max 100 at a time)
        const trackUris = window.matchingTracks.map(t => `spotify:track:${t.id}`);
        
        for (let i = 0; i < trackUris.length; i += 100) {
            const batch = trackUris.slice(i, i + 100);
            await spotifyAPI(
                `v1/playlists/${playlist.id}/tracks`,
                'POST',
                { uris: batch }
            );
        }
        
        alert(`Playlist created! Check your Spotify for "${playlist.name}"`);
        
    } catch (error) {
        console.error('Failed to create playlist:', error);
        alert('Failed to create playlist. Please try again.');
    }
});

// ============= Spotify Web Playback SDK & Audio Player =============
let spotifyPlayer = null;
let deviceId = null;

// Initialize Spotify Web Playback SDK
window.onSpotifyWebPlaybackSDKReady = () => {
    initializeSpotifyPlayer();
};

async function initializeSpotifyPlayer() {
    if (!accessToken) {
        addDebugLog('No access token available for Spotify Player');
        return;
    }
    
    try {
        spotifyPlayer = new Spotify.Player({
            name: 'BPM Pacer Player',
            getOAuthToken: cb => { cb(accessToken); },
            volume: 0.7
        });

        // Error handling
        spotifyPlayer.addListener('initialization_error', ({ message }) => {
            addDebugLog(`Spotify Player initialization error: ${message}`);
        });

        spotifyPlayer.addListener('authentication_error', ({ message }) => {
            addDebugLog(`Spotify Player authentication error: ${message}`);
        });

        spotifyPlayer.addListener('account_error', ({ message }) => {
            addDebugLog(`Spotify Player account error: ${message}`);
        });

        // Ready
        spotifyPlayer.addListener('ready', ({ device_id }) => {
            addDebugLog(`Spotify Player ready! Device ID: ${device_id}`);
            deviceId = device_id;
            document.getElementById('play-playlist').style.display = 'inline-block';
        });

        // Not ready
        spotifyPlayer.addListener('not_ready', ({ device_id }) => {
            addDebugLog(`Spotify Player device ${device_id} has gone offline`);
            deviceId = null;
        });

        // Player state changes
        spotifyPlayer.addListener('player_state_changed', (state) => {
            if (!state) return;
            
            audioPlayer.handleSpotifyStateChange(state);
        });

        // Connect to the player
        const connected = await spotifyPlayer.connect();
        if (connected) {
            addDebugLog('Spotify Player connected successfully');
        } else {
            addDebugLog('Failed to connect to Spotify Player');
        }
        
    } catch (error) {
        addDebugLog(`Error initializing Spotify Player: ${error.message}`);
    }
}

class AudioPlayer {
    constructor() {
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.currentTrack = null;
        this.position = 0;
        this.duration = 0;
        this.playbackRate = 1.0;
        
        this.bindEvents();
    }
    
    handleSpotifyStateChange(state) {
        if (!state || !state.track_window.current_track) return;
        
        const track = state.track_window.current_track;
        this.isPlaying = !state.paused;
        this.position = state.position;
        this.duration = state.duration;
        
        // Check if track changed
        const trackChanged = !this.currentTrack || this.currentTrack.id !== track.id;
        
        if (trackChanged) {
            // Find matching track in playlist
            const playlistTrack = this.playlist.find(t => t.id === track.id);
            if (playlistTrack) {
                this.currentTrack = playlistTrack;
                this.updatePlayerDisplay();
            } else {
                // Track not in our analyzed playlist - fetch BPM from Spotify API
                this.currentTrack = {
                    id: track.id,
                    name: track.name,
                    artists: track.artists,
                    duration_ms: track.duration_ms,
                    tempo: null // Will be fetched if needed
                };
                addDebugLog(`New track detected: ${track.name} - attempting to fetch BPM`);
                this.fetchTrackBPM(track.id);
            }
            
            // Auto-match BPM when track changes (regardless of mode)
            this.autoMatchBPM();
            
            // Auto-mute metronome and prepare for tap sync on track change
            if (metronome.isRunning) {
                metronome.stop();
                addDebugLog('🔇 Metronome muted for new track - ready for tap sync');
            }
            
            // Reset tap sync for new track
            beatDetector.resetTapSync();
            
            // Auto-calibrate beat sync if auto-sync is enabled and track is playing
            if (beatDetector.audioStream && this.isPlaying && !beatDetector.isListening) {
                setTimeout(() => {
                    addDebugLog(`Track changed to: ${track.name} - starting auto-calibration`);
                    beatDetector.startCalibration(track.id);
                }, 2000); // Wait 2 seconds for track to fully start
            }
        }
        
        // Update UI
        this.updateProgressBar();
        const button = document.getElementById('play-pause');
        button.textContent = this.isPlaying ? '⏸' : '▶';
        
        // Metronome BPM is already set via autoMatchBPM()
    }
    
    bindEvents() {
        document.getElementById('play-playlist').addEventListener('click', () => {
            this.startCustomPlaylist();
        });
        
        document.getElementById('play-pause').addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        document.getElementById('prev-track').addEventListener('click', () => {
            this.previousTrack();
        });
        
        document.getElementById('next-track').addEventListener('click', () => {
            this.nextTrack();
        });
    }
    
    async startCustomPlaylist() {
        if (!window.matchingTracks || window.matchingTracks.length === 0) {
            alert('No matching tracks found! Please analyze your music first.');
            return;
        }
        
        if (!deviceId) {
            alert('Spotify Player not ready! Please ensure you have Spotify Premium and try refreshing the page.');
            return;
        }
        
        // Create limited playlist based on duration setting
        const maxDurationMinutes = parseInt(document.getElementById('playlist-duration').value);
        this.playlist = createLimitedPlaylist(window.matchingTracks, maxDurationMinutes);
        
        if (this.playlist.length === 0) {
            alert('No tracks fit within the specified duration!');
            return;
        }
        
        this.currentIndex = 0;
        document.getElementById('player-section').classList.remove('hidden');
        document.getElementById('total-tracks').textContent = this.playlist.length;
        
        try {
            // Create track URIs for Spotify
            const trackUris = this.playlist.map(track => `spotify:track:${track.id}`);
            
            // Start playback on our device
            await this.startPlayback(trackUris, 0);
            
            this.updatePlayerDisplay();
            addDebugLog(`✅ Started Spotify playlist: ${this.playlist.length} tracks`);
            
            // Give Spotify time to start playing, then check status
            setTimeout(() => {
                if (!this.isPlaying) {
                    addDebugLog('⚠️ Playlist started but not playing - this is normal, tracks should start shortly');
                }
            }, 2000);
            
        } catch (error) {
            addDebugLog(`❌ Error starting playlist: ${error.message}`);
            
            // Wait a moment and check if playback actually started
            setTimeout(() => {
                if (this.isPlaying) {
                    addDebugLog('✅ Playlist actually started successfully despite API error');
                } else {
                    alert('Failed to start playlist. Please try again.');
                }
            }, 1500);
        }
    }
    
    async startPlayback(trackUris, offset = 0) {
        try {
            await spotifyAPI(
                `v1/me/player/play?device_id=${deviceId}`,
                'PUT',
                {
                    uris: trackUris,
                    offset: { position: offset }
                }
            );
            
            this.currentIndex = offset;
            this.currentTrack = this.playlist[offset];
            
        } catch (error) {
            throw new Error(`Failed to start playback: ${error.message}`);
        }
    }
    
    updatePlayerDisplay() {
        const track = this.playlist[this.currentIndex];
        if (!track) return;
        
        document.getElementById('current-track-name').textContent = track.name;
        document.getElementById('current-track-artist').textContent = track.artists.map(a => a.name).join(', ');
        document.getElementById('current-track-bpm').textContent = `${track.tempo.toFixed(3)} BPM`;
        document.getElementById('current-track-index').textContent = this.currentIndex + 1;
        
        // Update remaining time
        const remainingTracks = this.playlist.slice(this.currentIndex + 1);
        const remainingMs = remainingTracks.reduce((total, track) => total + (track.duration_ms || 180000), 0);
        document.getElementById('remaining-time').textContent = formatDuration(remainingMs);
        
        // Update metronome BPM to match current track
        this.currentTrack = track;
        this.autoMatchBPM();
    }
    
    updateProgressBar() {
        if (!this.duration) return;
        
        const percentage = (this.position / this.duration) * 100;
        document.getElementById('track-progress-fill').style.width = `${percentage}%`;
        document.getElementById('track-progress-handle').style.left = `${percentage}%`;
        
        document.getElementById('current-time').textContent = formatDuration(this.position);
        document.getElementById('total-time').textContent = formatDuration(this.duration);
    }
    
    async togglePlayPause() {
        if (!spotifyPlayer) {
            alert('Spotify Player not ready!');
            return;
        }
        
        try {
            await spotifyPlayer.togglePlay();
            
            // Don't auto-start metronome - let user control it via tap sync
            if (!this.isPlaying) {
                metronome.stop();
            }
        } catch (error) {
            addDebugLog(`Error toggling playback: ${error.message}`);
        }
    }
    
    async previousTrack() {
        if (!spotifyPlayer) return;
        
        try {
            await spotifyPlayer.previousTrack();
            if (this.currentIndex > 0) {
                this.currentIndex--;
                this.currentTrack = this.playlist[this.currentIndex];
                this.updatePlayerDisplay();
            }
        } catch (error) {
            addDebugLog(`Error going to previous track: ${error.message}`);
        }
    }
    
    async nextTrack() {
        if (!spotifyPlayer) return;
        
        try {
            await spotifyPlayer.nextTrack();
            if (this.currentIndex < this.playlist.length - 1) {
                this.currentIndex++;
                this.currentTrack = this.playlist[this.currentIndex];
                this.updatePlayerDisplay();
            }
        } catch (error) {
            addDebugLog(`Error going to next track: ${error.message}`);
        }
    }
    
    autoMatchBPM() {
        if (!this.currentTrack) return;
        
        // Check if track has BPM data
        if (this.currentTrack.tempo && this.currentTrack.tempo > 0) {
            const preciseBPM = this.currentTrack.tempo; // Keep precise decimal
            metronome.setBPM(preciseBPM); // Use exact BPM
            addDebugLog(`🎵 Auto-matched metronome to song BPM: ${preciseBPM.toFixed(1)} (displayed as ${displayBPM})`);
            
            // Update UI to show matched BPM (rounded)
            if (document.getElementById('current-track-bpm')) {
                document.getElementById('current-track-bpm').textContent = `${preciseBPM.toFixed(3)} BPM`;
            }
        } else {
            // No BPM data available - use target BPM as fallback
            const targetBPM = parseInt(document.getElementById('target-bpm').value);
            metronome.setBPM(targetBPM);
            addDebugLog(`⚠️ No BPM data for "${this.currentTrack.name}" - using target BPM: ${targetBPM}`);
            
            // Update UI to show fallback BPM
            if (document.getElementById('current-track-bpm')) {
                document.getElementById('current-track-bpm').textContent = `${targetBPM} BPM (target)`;
            }
        }
    }
    
    async fetchTrackBPM(trackId) {
        try {
            // First try to get BPM from Spotify's audio features
            const audioFeatures = await spotifyAPI(`v1/audio-features/${trackId}`);
            if (audioFeatures && audioFeatures.tempo) {
                this.currentTrack.tempo = audioFeatures.tempo;
                addDebugLog(`✅ Fetched BPM from Spotify: ${audioFeatures.tempo.toFixed(1)} for "${this.currentTrack.name}"`);
                this.autoMatchBPM(); // Re-run auto-match with new BPM data
                return;
            }
        } catch (error) {
            addDebugLog(`❌ Failed to fetch BPM from Spotify: ${error.message}`);
        }
        
        // Fallback: Try ReccoBeats API for BPM (similar to existing analysis)
        try {
            const myHeaders = new Headers();
            myHeaders.append("Accept", "application/json");
            
            const requestOptions = {
                method: "GET",
                headers: myHeaders,
                redirect: "follow"
            };
            
            // Get ReccoBeats track ID
            const url = new URL('https://api.reccobeats.com/v1/audio-features');
            url.searchParams.append('ids', trackId);
            
            const response = await fetch(url.toString(), requestOptions);
            if (!response.ok) throw new Error(`ReccoBeats API error: ${response.status}`);
            
            const data = await response.json();
            const features = Array.isArray(data) ? data : (data.content || data.audio_features || data.features || []);
            
            if (features.length > 0 && features[0].id) {
                // Get detailed audio features using ReccoBeats ID
                const detailsUrl = `https://api.reccobeats.com/v1/track/${features[0].id}/audio-features`;
                const detailsResponse = await fetch(detailsUrl, requestOptions);
                
                if (detailsResponse.ok) {
                    const audioFeature = await detailsResponse.json();
                    const tempo = audioFeature?.tempo || audioFeature?.bpm;
                    
                    if (tempo && typeof tempo === 'number' && tempo > 0) {
                        this.currentTrack.tempo = tempo;
                        addDebugLog(`✅ Fetched BPM from ReccoBeats: ${tempo.toFixed(1)} for "${this.currentTrack.name}"`);
                        this.autoMatchBPM(); // Re-run auto-match with new BPM data
                        return;
                    }
                }
            }
        } catch (error) {
            addDebugLog(`❌ Failed to fetch BPM from ReccoBeats: ${error.message}`);
        }
        
        // If all methods fail, auto-match will use target BPM as fallback
        addDebugLog(`⚠️ Could not fetch BPM for "${this.currentTrack.name}" - will use target BPM as fallback`);
        this.autoMatchBPM();
    }
    
}

// ============= Audio Beat Detection System =============
class BeatDetector {
    constructor() {
        this.audioStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.isListening = false;
        this.calibrationStartTime = null;
        this.detectedBeats = [];
        this.currentTrackId = null;
        this.beatOffset = null; // Phase offset for current track
        
        // Beat detection parameters
        this.fftSize = 2048;
        this.bassFreqRange = { min: 0, max: 8 }; // Indices for ~60-120Hz
        this.beatThreshold = 0.3;
        this.adaptiveThreshold = 0.3; // Dynamic threshold that adapts to volume
        this.minBeatInterval = 300; // Min 300ms between beats (200 BPM max)
        this.lastBeatTime = 0;
        this.energyHistory = []; // Track energy levels for adaptive thresholding
        this.maxEnergyHistorySize = 100;
        
        // Enhanced frequency ranges for different music styles
        this.frequencyRanges = {
            kick: { min: 0, max: 8 },      // ~60-120Hz - Kick drums
            snare: { min: 8, max: 24 },    // ~120-350Hz - Snare drums  
            lowMid: { min: 24, max: 64 },  // ~350-800Hz - Low mids
            highMid: { min: 64, max: 128 } // ~800-1600Hz - High mids
        };
        
        // Calibration settings
        this.calibrationDuration = 15000; // 15 seconds for better accuracy
        this.minBeatsRequired = 10; // Need at least 10 beats for good calibration
        this.maxCalibrationAttempts = 3;
        this.currentCalibrationAttempt = 0;
        
        // Manual tap sync settings
        this.tapTimes = [];
        this.maxTapHistory = 8; // Keep last 8 taps for analysis
        this.isTapSyncActive = false;
        this.minTapsRequired = 4; // Need at least 4 taps for sync
        this.maxTapInterval = 2000; // Max 2 seconds between taps
        this.isAutoTapMode = true; // Always ready for tap sync
        this.tapFeedbackAudio = null; // Audio context for tap feedback
        this.lastTapTime = 0; // Track last tap for timeout
        this.tapTimeoutId = null; // Timer to reset taps
    }
    
    async requestAudioAccess() {
        try {
            addDebugLog('Requesting system audio access...');
            
            // Debug browser capabilities
            addDebugLog(`Browser: ${navigator.userAgent}`);
            addDebugLog(`getDisplayMedia supported: ${!!navigator.mediaDevices?.getDisplayMedia}`);
            addDebugLog(`getUserMedia supported: ${!!navigator.mediaDevices?.getUserMedia}`);
            addDebugLog(`HTTPS: ${location.protocol === 'https:'}`);
            
            // Check if getDisplayMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                // Fallback: try getUserMedia for microphone (less ideal but might work)
                addDebugLog('getDisplayMedia not supported, trying microphone fallback...');
                
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Neither getDisplayMedia nor getUserMedia supported in this browser. Please use Chrome 72+ or Firefox 66+.');
                }
                
                try {
                    this.audioStream = await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false
                        }
                    });
                    addDebugLog('Microphone access granted - will detect ambient audio');
                } catch (micError) {
                    addDebugLog(`Microphone access failed: ${micError.name} - ${micError.message}`);
                    throw new Error(`Audio access failed: ${micError.message}. Try "Tap to Sync" instead.`);
                }
            } else {
                // Request system audio capture via screen sharing
                // Note: Chrome requires video:true even if we only want audio
                this.audioStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true, // Required by Chrome, but we'll only use audio
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        sampleRate: 44100
                    }
                });
                
                // Stop video track immediately since we only need audio
                const videoTracks = this.audioStream.getVideoTracks();
                videoTracks.forEach(track => track.stop());
            }
            
            // Check if we actually got audio
            const audioTracks = this.audioStream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error('No audio track received - make sure to check "Share audio" in the permission dialog');
            }
            
            addDebugLog(`Audio stream received: ${audioTracks.length} audio tracks`);
            
            // Set up audio analysis with proper browser compatibility
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error('Web Audio API not supported in this browser');
            }
            this.audioContext = new AudioContextClass();
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.analyser = this.audioContext.createAnalyser();
            
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.3;
            source.connect(this.analyser);
            
            addDebugLog('Audio capture initialized successfully');
            return true;
            
        } catch (error) {
            addDebugLog(`Audio capture failed: ${error.name} - ${error.message}`);
            addDebugLog(`Error stack: ${error.stack}`);
            
            // Provide specific guidance based on error type
            if (error.name === 'NotAllowedError') {
                alert('Audio access denied. Please:\n1. Click "Enable Auto-Sync" again\n2. In the permission dialog, check "Share audio"\n3. Click "Share" (not Cancel)');
            } else if (error.name === 'NotSupportedError') {
                alert('Screen capture not supported or denied. Please:\n1. Make sure you\'re in Chrome/Edge\n2. Select "Chrome Tab" or "Entire Screen"\n3. Check "Share audio" checkbox\n4. Or use "Tap to Sync" instead');
            } else if (error.name === 'AbortError') {
                alert('Screen capture was cancelled. Please try again and select "Share" with audio enabled.');
            } else {
                alert(`Audio capture failed: ${error.message}\n\nTry "Tap to Sync" as an alternative.`);
            }
            
            return false;
        }
    }
    
    async requestMicrophoneAccess() {
        try {
            addDebugLog('Requesting microphone access...');
            
            this.audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100
                }
            });
            
            // Check if we actually got audio
            const audioTracks = this.audioStream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error('No audio track received from microphone');
            }
            
            addDebugLog(`Microphone stream received: ${audioTracks.length} audio tracks`);
            
            // Set up audio analysis
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error('Web Audio API not supported in this browser');
            }
            this.audioContext = new AudioContextClass();
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.analyser = this.audioContext.createAnalyser();
            
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.3;
            source.connect(this.analyser);
            
            addDebugLog('Microphone capture initialized successfully');
            return true;
            
        } catch (error) {
            addDebugLog(`Microphone capture failed: ${error.name} - ${error.message}`);
            
            if (error.name === 'NotAllowedError') {
                alert('Microphone access denied. Please allow microphone access and try again.');
            } else if (error.name === 'NotFoundError') {
                alert('No microphone found. Please connect a microphone and try again.');
            } else {
                alert(`Microphone capture failed: ${error.message}`);
            }
            
            return false;
        }
    }
    
    startCalibration(trackId) {
        if (!this.analyser) {
            addDebugLog('⚠️ No audio analyser available - cannot start calibration');
            return false;
        }
        
        if (this.isListening) {
            addDebugLog('⚠️ Calibration already in progress');
            return false;
        }
        
        this.currentTrackId = trackId;
        this.detectedBeats = [];
        this.energyHistory = []; // Reset energy history for new track
        this.calibrationStartTime = Date.now();
        this.isListening = true;
        this.beatOffset = null;
        this.currentCalibrationAttempt++;
        
        // Update UI
        document.getElementById('sync-status').classList.remove('hidden');
        document.getElementById('sync-progress').classList.add('listening');
        document.getElementById('sync-text').textContent = 
            `Listening for beats... (attempt ${this.currentCalibrationAttempt}/${this.maxCalibrationAttempts})`;
        
        addDebugLog(`Starting beat calibration for track: ${trackId} (attempt ${this.currentCalibrationAttempt})`);
        this.calibrationLoop();
        
        // Auto-stop after calibration duration
        setTimeout(() => {
            this.stopCalibration();
        }, this.calibrationDuration);
        
        return true;
    }
    
    calibrationLoop() {
        if (!this.isListening) return;
        
        const currentTime = Date.now();
        const elapsed = currentTime - this.calibrationStartTime;
        
        // Update progress
        const progress = Math.min(elapsed / this.calibrationDuration * 100, 100);
        document.querySelector('#sync-progress').style.setProperty('--progress', `${progress}%`);
        
        // Analyze audio for beats
        const beatDetected = this.detectBeat();
        if (beatDetected) {
            const spotifyPosition = audioPlayer.position; // Current Spotify position
            this.detectedBeats.push({
                timestamp: currentTime,
                spotifyPosition: spotifyPosition
            });
            
            // Visual feedback for detected beat
            this.flashBeatDetection();
            
            addDebugLog(`Beat detected at Spotify position: ${spotifyPosition}ms`);
        }
        
        // Continue loop
        if (this.isListening) {
            requestAnimationFrame(() => this.calibrationLoop());
        }
    }
    
    detectBeat() {
        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(frequencyData);
        
        // Calculate energy in multiple frequency ranges
        const energies = {
            kick: this.calculateRangeEnergy(frequencyData, this.frequencyRanges.kick),
            snare: this.calculateRangeEnergy(frequencyData, this.frequencyRanges.snare),
            lowMid: this.calculateRangeEnergy(frequencyData, this.frequencyRanges.lowMid),
            highMid: this.calculateRangeEnergy(frequencyData, this.frequencyRanges.highMid)
        };
        
        // Focus on kick and snare for beat detection (most reliable)
        const totalBeatEnergy = (energies.kick * 0.7) + (energies.snare * 0.3);
        
        // Update energy history for adaptive thresholding
        this.energyHistory.push(totalBeatEnergy);
        if (this.energyHistory.length > this.maxEnergyHistorySize) {
            this.energyHistory.shift();
        }
        
        // Calculate adaptive threshold based on recent energy levels
        if (this.energyHistory.length > 10) {
            const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
            const maxEnergy = Math.max(...this.energyHistory);
            
            // Set threshold between average and max, closer to max for sensitivity
            this.adaptiveThreshold = avgEnergy + ((maxEnergy - avgEnergy) * 0.6);
        }
        
        // Enhanced beat detection with spectral flux analysis
        const currentTime = Date.now();
        const isEnergyPeak = totalBeatEnergy > this.adaptiveThreshold;
        const isTimingValid = currentTime - this.lastBeatTime > this.minBeatInterval;
        
        // Additional validation: check if energy significantly increased from recent average
        const recentAvg = this.energyHistory.length > 5 ? 
            this.energyHistory.slice(-5).reduce((a, b) => a + b, 0) / 5 : totalBeatEnergy;
        const isSignificantIncrease = totalBeatEnergy > recentAvg * 1.3;
        
        if (isEnergyPeak && isTimingValid && isSignificantIncrease) {
            this.lastBeatTime = currentTime;
            addDebugLog(`🥁 Beat detected: energy=${totalBeatEnergy.toFixed(3)}, threshold=${this.adaptiveThreshold.toFixed(3)}`);
            return true;
        }
        
        return false;
    }
    
    calculateRangeEnergy(frequencyData, range) {
        let energy = 0;
        for (let i = range.min; i <= range.max && i < frequencyData.length; i++) {
            energy += frequencyData[i];
        }
        return energy / (range.max - range.min + 1) / 255; // Normalize to 0-1
    }
    
    stopCalibration() {
        this.isListening = false;
        document.getElementById('sync-progress').classList.remove('listening');
        
        if (this.detectedBeats.length < this.minBeatsRequired) {
            addDebugLog(`Calibration attempt ${this.currentCalibrationAttempt} failed: only ${this.detectedBeats.length} beats detected`);
            
            // Try again if we haven't reached max attempts
            if (this.currentCalibrationAttempt < this.maxCalibrationAttempts) {
                document.getElementById('sync-text').textContent = 
                    `Not enough beats (${this.detectedBeats.length}/${this.minBeatsRequired}). Retrying...`;
                
                // Wait 2 seconds then retry
                setTimeout(() => {
                    if (audioPlayer.isPlaying && audioPlayer.currentTrack) {
                        addDebugLog(`🔄 Retrying calibration (attempt ${this.currentCalibrationAttempt + 1})`);
                        this.startCalibration(this.currentTrackId);
                    } else {
                        this.handleCalibrationFailure();
                    }
                }, 2000);
            } else {
                this.handleCalibrationFailure();
            }
            
            return false;
        }
        
        // Calculate beat offset
        this.calculateBeatOffset();
        
        document.getElementById('sync-text').textContent = 
            `✓ Synced! (${this.detectedBeats.length} beats analyzed)`;
        
        setTimeout(() => {
            document.getElementById('sync-status').classList.add('hidden');
        }, 2000);
        
        // Reset attempt counter on success
        this.currentCalibrationAttempt = 0;
        
        addDebugLog(`✅ Calibration successful: ${this.detectedBeats.length} beats, offset: ${this.beatOffset}ms`);
        return true;
    }
    
    handleCalibrationFailure() {
        document.getElementById('sync-text').textContent = 
            `Sync failed after ${this.maxCalibrationAttempts} attempts. Check audio volume or try manual sync.`;
        
        setTimeout(() => {
            document.getElementById('sync-status').classList.add('hidden');
        }, 5000);
        
        // Reset attempt counter
        this.currentCalibrationAttempt = 0;
        
        addDebugLog(`❌ Calibration failed after ${this.maxCalibrationAttempts} attempts`);
    }
    
    calculateBeatOffset() {
        if (this.detectedBeats.length === 0) return;
        
        const currentTrack = audioPlayer.playlist[audioPlayer.currentIndex];
        const bpm = currentTrack.tempo;
        const beatInterval = 60000 / bpm; // milliseconds per beat
        
        // Find the most consistent beat phase
        const phases = this.detectedBeats.map(beat => 
            beat.spotifyPosition % beatInterval
        );
        
        // Use median phase to avoid outliers
        phases.sort((a, b) => a - b);
        const medianPhase = phases[Math.floor(phases.length / 2)];
        
        this.beatOffset = medianPhase;
        
        // Apply smooth transition to metronome
        metronome.smoothTransitionToPhase(this.beatOffset, bpm);
    }
    
    flashBeatDetection() {
        const indicator = document.getElementById('metronome-visual');
        indicator.style.background = '#ff6b35';
        indicator.style.transform = 'scale(1.3)';
        
        setTimeout(() => {
            indicator.style.background = '';
            indicator.style.transform = '';
        }, 100);
    }
    
    initializeTapFeedbackAudio() {
        if (!this.tapFeedbackAudio) {
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                this.tapFeedbackAudio = new AudioContextClass();
            } catch (error) {
                addDebugLog('Failed to initialize tap feedback audio:', error);
            }
        }
    }
    
    playTapFeedback() {
        this.initializeTapFeedbackAudio();
        
        if (!this.tapFeedbackAudio) return;
        
        try {
            // Resume audio context if suspended
            if (this.tapFeedbackAudio.state === 'suspended') {
                this.tapFeedbackAudio.resume();
            }
            
            const oscillator = this.tapFeedbackAudio.createOscillator();
            const gainNode = this.tapFeedbackAudio.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.tapFeedbackAudio.destination);
            
            // Higher pitched click for tap feedback (different from metronome)
            oscillator.frequency.setValueAtTime(1200, this.tapFeedbackAudio.currentTime);
            gainNode.gain.setValueAtTime(0.4, this.tapFeedbackAudio.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.tapFeedbackAudio.currentTime + 0.1);
            
            oscillator.start(this.tapFeedbackAudio.currentTime);
            oscillator.stop(this.tapFeedbackAudio.currentTime + 0.1);
        } catch (error) {
            addDebugLog('Error playing tap feedback:', error);
        }
    }
    
    resetTapSync() {
        this.tapTimes = [];
        this.lastTapTime = 0;
        
        // Clear any existing timeout
        if (this.tapTimeoutId) {
            clearTimeout(this.tapTimeoutId);
            this.tapTimeoutId = null;
        }
        
        // Reset button
        const button = document.getElementById('tap-sync-toggle');
        if (button) {
            button.textContent = 'Tap to Sync';
            button.style.background = '';
        }
        
        addDebugLog('🔄 Tap sync reset');
    }

    handleTap() {
        const currentTime = Date.now();
        
        // Check if this is a fresh start (after timeout or first tap)
        if (this.tapTimes.length === 0 || currentTime - this.lastTapTime > this.maxTapInterval) {
            addDebugLog('🆕 Starting new tap sequence - silencing metronome');
            this.resetTapSync();
            
            // Silence the metronome while tapping
            if (metronome.isRunning) {
                metronome.stop();
                addDebugLog('🔇 Metronome silenced for tap sync');
            }
        }
        
        // Add current tap time
        this.tapTimes.push(currentTime);
        this.lastTapTime = currentTime;
        
        // Remove old taps beyond max history
        if (this.tapTimes.length > this.maxTapHistory) {
            this.tapTimes.shift();
        }
        
        // Clear any existing timeout and set new one
        if (this.tapTimeoutId) {
            clearTimeout(this.tapTimeoutId);
        }
        
        // Auto-reset after timeout if no more taps
        this.tapTimeoutId = setTimeout(() => {
            addDebugLog('⏱️ Tap sequence timed out - resetting and restarting metronome');
            this.resetTapSync();
            // Restart metronome when tapping times out
            if (!metronome.isRunning) {
                metronome.start();
                addDebugLog('🎵 Metronome restarted after tap timeout');
            }
        }, this.maxTapInterval);
        
        addDebugLog(`👆 Tap ${this.tapTimes.length} recorded`);
        
        // Always provide audio and visual feedback
        this.playTapFeedback();
        this.flashTapFeedback();
        
        // Show progress
        const button = document.getElementById('tap-sync-toggle');
        button.textContent = `Tap ${this.tapTimes.length}/${this.minTapsRequired}`;
        
        // Try to calculate sync if we have enough taps
        if (this.tapTimes.length >= this.minTapsRequired) {
            const result = this.calculateTapSync();
            if (result.success) {
                // Clear timeout since we succeeded
                if (this.tapTimeoutId) {
                    clearTimeout(this.tapTimeoutId);
                    this.tapTimeoutId = null;
                }
                
                // Calculate when the next beat should occur (using song BPM, not tap BPM)
                const timeSinceLastTap = Date.now() - this.tapTimes[this.tapTimes.length - 1];
                const nextBeatDelay = Math.max(0, result.beatInterval - timeSinceLastTap);
                
                addDebugLog(`⏱️ Next beat in ${nextBeatDelay.toFixed(1)}ms`);
                
                // Start metronome at the exact moment of the next beat
                setTimeout(() => {
                    if (!metronome.isRunning) {
                        metronome.start();
                        addDebugLog('🎵 Metronome started at exact next beat timing');
                    }
                }, nextBeatDelay);
                
                // Reset tap sync after a brief delay
                setTimeout(() => {
                    this.resetTapSync();
                }, 1500);
            } else {
                // Failed - if we've hit max taps, reset and start fresh
                if (this.tapTimes.length >= this.maxTapHistory) {
                    addDebugLog('📈 Max taps reached with inconsistent timing - resetting for fresh start');
                    setTimeout(() => {
                        this.resetTapSync();
                        // Restart metronome with original timing
                        if (!metronome.isRunning) {
                            metronome.start();
                            addDebugLog('🎵 Metronome restarted after failed tap sync');
                        }
                    }, 1500); // Brief delay to show "Try again" message
                }
            }
        }
    }
    
    calculateTapSync() {
        if (this.tapTimes.length < this.minTapsRequired) return { success: false };
        
        // Calculate intervals between taps
        const intervals = [];
        for (let i = 1; i < this.tapTimes.length; i++) {
            intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
        }
        
        // Calculate median interval to avoid outliers
        // const sortedIntervals = intervals.sort((a, b) => a - b);
        // const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
        
        // Check if intervals are consistent (within 30% variance for more forgiveness)
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => 
            sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const standardDeviation = Math.sqrt(variance);
        const consistencyThreshold = avgInterval * 0.3; // 30% tolerance - more forgiving
        
        if (standardDeviation <= consistencyThreshold) {
            // Get the current track's BPM (don't change it!)
            const currentTrack = audioPlayer.currentTrack;
            const trackBPM = currentTrack?.tempo;
            
            if (!trackBPM || trackBPM <= 0) {
                addDebugLog(`⚠️ No track BPM available for sync - need track BPM data first`);
                document.getElementById('sync-text').textContent = 
                    `No track BPM available. Play a song with BPM data first.`;
                return { success: false };
            }
            
            // Calculate beat interval from track BPM (not tap BPM!)
            const beatInterval = 60000 / trackBPM;
            
            // Calculate phase offset based on current Spotify position
            const spotifyPosition = audioPlayer.position || 0;
            const lastTapTime = this.tapTimes[this.tapTimes.length - 1];
            const timeSinceLastTap = Date.now() - lastTapTime;
            const estimatedCurrentPosition = spotifyPosition + timeSinceLastTap;
            
            // Calculate where the last tap fell within the beat cycle
            const beatOffset = estimatedCurrentPosition % beatInterval;
            
            // Apply phase sync only (keep existing BPM)
            this.beatOffset = beatOffset;
            metronome.smoothTransitionToPhase(beatOffset, trackBPM);
            
            // Update UI briefly
            const button = document.getElementById('tap-sync-toggle');
            const originalText = button.textContent;
            button.textContent = '✓ Synced!';
            button.style.background = '#4CAF50';
            
            setTimeout(() => {
                button.textContent = 'Tap to Sync';
                button.style.background = '';
            }, 1500);
            
            addDebugLog(`✅ Tap sync successful: phase offset=${beatOffset.toFixed(1)}ms, keeping track BPM=${trackBPM}`);
            return { success: true, beatInterval };
        } else {
            addDebugLog(`⚠️ Tap timing inconsistent (std dev: ${standardDeviation.toFixed(1)}ms)`);
        }
        
        // If we reach here, sync failed - give feedback but continue listening
        const button = document.getElementById('tap-sync-toggle');
        button.textContent = 'Try again...';
        button.style.background = '#ff9800';
        
        setTimeout(() => {
            button.textContent = 'Tap to Sync';
            button.style.background = '';
        }, 1500);
        
        return { success: false };
    }
    
    flashTapFeedback() {
        const indicator = document.getElementById('metronome-visual');
        indicator.style.background = '#4CAF50'; // Green for tap feedback
        indicator.style.transform = 'scale(1.2)';
        
        setTimeout(() => {
            indicator.style.background = '';
            indicator.style.transform = '';
        }, 150);
    }
    
    cleanup() {
        this.isListening = false;
        this.isTapSyncActive = false;
        this.tapTimes = [];
        
        // Clear tap timeout
        if (this.tapTimeoutId) {
            clearTimeout(this.tapTimeoutId);
            this.tapTimeoutId = null;
        }
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// ============= Runner Visualization Class =============
class RunnerVisualization {
    constructor() {
        this.layers = document.querySelectorAll('.bg-layer');
        this.runner = document.querySelector('.runner-sprite');
        this.baseSpeed = 0; // pixels per frame
        this.isRunning = false;
        this.animationFrame = null;
        this.layerPositions = new Map();
        
        // Initialize layer positions
        this.layers.forEach(layer => {
            this.layerPositions.set(layer, 0);
        });
    }
    
    setBPM(bpm) {
        // Convert BPM to base scrolling speed
        // Higher BPM = faster scrolling to create sense of speed
        this.baseSpeed = (bpm / 60) * 30; // 30 pixels per second per BPM unit
    }
    
    start() {
        this.isRunning = true;
        this.animate();
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
    
    animate() {
        if (!this.isRunning) return;
        
        this.layers.forEach(layer => {
            const speed = parseFloat(layer.dataset.speed) || 0.5;
            const currentX = this.layerPositions.get(layer);
            const newX = currentX - (this.baseSpeed * speed * 0.016); // 60fps
            
            // Reset position for seamless loop when layer scrolls past
            const resetX = newX <= -layer.offsetWidth / 2 ? 0 : newX;
            this.layerPositions.set(layer, resetX);
            
            layer.style.transform = `translateX(${resetX}px)`;
        });
        
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    
    // Called on each metronome beat
    onBeat() {
        if (this.runner) {
            this.runner.classList.add('step');
            setTimeout(() => {
                this.runner.classList.remove('step');
            }, 150);
        }
    }
}

// Metronome class
class Metronome {
    constructor() {
        this.bpm = 120;
        this.isRunning = false;
        this.intervalId = null;
        this.timeoutId = null;
        this.nextBeatTime = 0;
        this.audioContext = null;
        this.volume = 0.5;
        this.phase = 0; // Current phase offset for smooth transitions
        this.targetPhase = 0; // Target phase for smooth transitions
        this.isTransitioning = false;
        
        this.bindEvents();
        this.initializeAudio();
    }
    
    async initializeAudio() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error('Web Audio API not supported in this browser');
            }
            this.audioContext = new AudioContextClass();
        } catch (error) {
            console.error('Failed to initialize metronome audio:', error);
        }
    }
    
    bindEvents() {
        document.getElementById('metronome-toggle').addEventListener('click', () => {
            this.toggle();
        });
        
        document.getElementById('metronome-volume').addEventListener('input', (e) => {
            this.volume = e.target.value / 100;
        });
        
        document.getElementById('song-volume').addEventListener('input', async (e) => {
            const volume = e.target.value / 100;
            if (spotifyPlayer) {
                try {
                    await spotifyPlayer.setVolume(volume);
                    addDebugLog(`🔊 Song volume set to ${Math.round(volume * 100)}%`);
                } catch (error) {
                    addDebugLog(`Failed to set song volume: ${error.message}`);
                }
            }
        });
        
        document.getElementById('auto-sync-toggle').addEventListener('click', () => {
            this.toggleAutoSync();
        });
        
        
        document.getElementById('tap-sync-toggle').addEventListener('click', (e) => {
            // Always count as a tap (no need to toggle mode)
            beatDetector.handleTap();
        });
        
        // Add tap handler to metronome visual for easier tapping
        document.getElementById('metronome-visual').addEventListener('click', () => {
            beatDetector.handleTap();
        });
        
        // Also allow space bar and Enter key for tapping
        document.addEventListener('keydown', (e) => {
            if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
                e.preventDefault();
                beatDetector.handleTap();
            }
        });
    }
    
    async toggleAutoSync() {
        const button = document.getElementById('auto-sync-toggle');
        
        if (!beatDetector.audioStream) {
            // Request audio access
            button.textContent = 'Requesting Access...';
            const success = await beatDetector.requestAudioAccess();
            
            if (success) {
                button.textContent = 'Disable Auto-Sync';
                button.classList.add('active');
                addDebugLog('Auto-sync enabled - audio capture ready');
                
                // Auto-calibrate if currently playing
                if (audioPlayer.isPlaying && audioPlayer.currentTrack) {
                    setTimeout(() => {
                        beatDetector.startCalibration(audioPlayer.currentTrack.id);
                    }, 1000);
                }
            } else {
                button.textContent = 'Enable Auto-Sync';
                alert('Audio access denied. Please allow system audio capture to use auto-sync.');
            }
        } else {
            // Disable auto-sync
            beatDetector.cleanup();
            button.textContent = 'Enable Auto-Sync';
            button.classList.remove('active');
            addDebugLog('Auto-sync disabled');
        }
    }
    
    
    setBPM(bpm) {
        this.bpm = bpm; // Use precise decimal for timing
        document.getElementById('metronome-bpm').textContent = `${bpm.toFixed(3)} BPM`;
        
        // Update visualization speed
        if (window.runnerViz) {
            window.runnerViz.setBPM(bpm);
        }
        
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }
    
    async start() {
        if (this.isRunning) return;
        
        // Resume AudioContext if suspended (fixes start delay)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                addDebugLog('AudioContext resumed for metronome');
            } catch (error) {
                addDebugLog(`Failed to resume AudioContext: ${error.message}`);
            }
        }
        
        this.isRunning = true;
        document.getElementById('metronome-toggle').textContent = 'Stop Metronome';
        
        // Start visualization
        if (window.runnerViz) {
            window.runnerViz.start();
        }
        
        // Play first beat immediately to eliminate start delay
        this.playBeat();
        this.visualBeat();
        
        // Then schedule subsequent beats
        this.scheduleNextBeat();
    }
    
    scheduleNextBeat() {
        if (!this.isRunning) return;
        
        // Use precise timing without setInterval rounding
        const interval = 60000 / this.bpm; // precise milliseconds per beat
        this.nextBeatTime = Date.now() + interval + this.phase;
        this.phase = 0; // Reset phase after first beat
        
        this.scheduleExactBeat();
    }
    
    scheduleExactBeat() {
        if (!this.isRunning) return;
        
        const now = Date.now();
        const delay = Math.max(0, this.nextBeatTime - now);
        
        this.timeoutId = setTimeout(() => {
            if (this.isRunning) {
                this.playBeat();
                this.visualBeat();
                
                // Calculate next beat time precisely
                const interval = 60000 / this.bpm;
                this.nextBeatTime += interval;
                
                // Schedule next beat
                this.scheduleExactBeat();
            }
        }, delay);
    }
    
    smoothTransitionToPhase(beatOffset, bpm) {
        // Update BPM first if it changed
        if (Math.abs(this.bpm - bpm) > 0.001) {
            this.bpm = bpm;
            document.getElementById('metronome-bpm').textContent = `${bpm.toFixed(3)} BPM`;
        }
        
        if (!this.isRunning) {
            this.phase = beatOffset;
            return;
        }
        
        // Calculate smooth transition using precise timing
        const interval = 60000 / bpm;
        const now = Date.now();
        const currentPhase = now % interval;
        const phaseDifference = (beatOffset - currentPhase + interval) % interval;
        
        // Avoid jarring transitions - only adjust if difference is significant
        if (Math.abs(phaseDifference) > 50 && Math.abs(phaseDifference) < interval - 50) {
            addDebugLog(`Smoothly adjusting metronome phase by ${phaseDifference.toFixed(1)}ms`);
            
            // Adjust next beat time precisely without stopping/starting
            this.nextBeatTime = now + phaseDifference;
            
            // Clear current timeout and reschedule
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
            this.scheduleExactBeat();
        } else {
            addDebugLog('Phase difference too small for smooth transition - keeping current timing');
        }
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        document.getElementById('metronome-toggle').textContent = 'Start Metronome';
        
        // Stop visualization
        if (window.runnerViz) {
            window.runnerViz.stop();
        }
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
    
    toggle() {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    playBeat() {
        if (!this.audioContext || this.volume === 0) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        } catch (error) {
            console.error('Error playing metronome beat:', error);
        }
    }
    
    visualBeat() {
        const beatElement = document.getElementById('metronome-visual');
        beatElement.classList.add('active');
        
        // Trigger runner step animation
        if (window.runnerViz) {
            window.runnerViz.onBeat();
        }
        
        setTimeout(() => {
            beatElement.classList.remove('active');
        }, 150);
    }
}

// Initialize components
const beatDetector = new BeatDetector();
const audioPlayer = new AudioPlayer();
const metronome = new Metronome();

// Initialize runner visualization when DOM is ready
function initializeVisualization() {
    if (document.querySelector('.runner-visualization')) {
        window.runnerViz = new RunnerVisualization();
        addDebugLog('Runner visualization initialized');
    } else {
        addDebugLog('⚠️ Runner visualization container not found');
    }
}

// Try to initialize immediately, or wait for DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVisualization);
} else {
    initializeVisualization();
}

// ============= Initialize =============
checkForToken();