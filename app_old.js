// ============= Configuration =============
//addDebugLog('VERSION STAMP', { build: 'getTracksWithBPM MAX_IDS=20 / single-ID fallback v3' });

const CLIENT_ID = '593a5515c27d4db4873b52036524e37c'; 
const REDIRECT_URI = 'https://0b9c5f03c43b.ngrok-free.app';//'http://localhost:3000';
const SCOPES = [
    'user-read-private',
    'user-library-read',  // ADDED: For Liked Songs access
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private'
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

// // Exchange authorization code for access token
// async function exchangeCodeForToken(code) {
//     const codeVerifier = localStorage.getItem('spotify_code_verifier');
    
//     try {
//         const response = await fetch('https://accounts.spotify.com/api/token', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/x-www-form-urlencoded'
//             },
//             body: new URLSearchParams({
//                 client_id: CLIENT_ID,
//                 grant_type: 'authorization_code',
//                 code: code,
//                 redirect_uri: REDIRECT_URI,
//                 code_verifier: codeVerifier
//             })
//         });
        
//         if (!response.ok) {
//             throw new Error('Token exchange failed');
//         }
        
//         const data = await response.json();
//         accessToken = data.access_token;
        
//         // Clean up
//         localStorage.removeItem('spotify_auth_state');
//         localStorage.removeItem('spotify_code_verifier');
//         window.history.replaceState(null, null, window.location.pathname);
        
//         showApp();
//         loadUserInfo();
        
//     } catch (error) {
//         console.error('Token exchange failed:', error);
//         alert('Authentication failed. Please try again.');
//     }
// }

async function exchangeCodeForToken(code) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');

    console.log('--- Initiating Token Exchange ---');
    console.log('1. Authorization Code:', code);
    console.log('2. Code Verifier:', codeVerifier);
    console.log('3. Redirect URI:', REDIRECT_URI);
    console.log('4. Client ID:', CLIENT_ID);

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

        // Get the response body regardless of success or failure
        const data = await response.json();

        // Check for failure
        if (!response.ok) {
            console.error('❌ TOKEN EXCHANGE FAILED. Spotify returned an error:', data);
            throw new Error(`Token exchange failed: ${data.error} - ${data.error_description}`);
        }

        console.log('✅ Token exchange successful:', data);
        accessToken = data.access_token;

        // Clean up
        localStorage.removeItem('spotify_auth_state');
        localStorage.removeItem('spotify_code_verifier');
        window.history.replaceState(null, null, window.location.pathname);

        showApp();
        loadUserInfo();

    } catch (error) {
        console.error('Error during token exchange function:', error);
        alert(`Authentication failed. Check the console for details. Error: ${error.message}`);
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
                <div style="margin-bottom: 10px;">
                    <label style="color: white;">
                        <input type="checkbox" id="liked-songs-only" checked> Analyze Liked Songs Only
                    </label>
                </div>
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
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
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
    const likedSongsOnly = document.getElementById('liked-songs-only').checked;
    
    // Clear previous debug logs
    debugLog = [];
    if (document.getElementById('debug-content')) {
        document.getElementById('debug-content').textContent = '';
    }
    
    addDebugLog(`Starting analysis: Target BPM = ${targetBPM}, Tolerance = ±${tolerance}`);
    addDebugLog(`Mode: ${likedSongsOnly ? 'Liked Songs Only' : 'All Playlists'}`);
    
    // Show progress
    document.getElementById('progress').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    
    try {
        let allTracks = [];
        
        if (likedSongsOnly) {
            // Get only Liked Songs
            updateProgress('Fetching your Liked Songs...', 20);
            allTracks = await getLikedSongs();
        } else {
            // Original behavior - get all playlists
            updateProgress('Fetching your playlists...', 10);
            const playlists = await getAllPlaylists();
            
            updateProgress('Collecting tracks...', 30);
            allTracks = await getAllTracksFromPlaylists(playlists);
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

// Get audio features (BPM) for tracks - UPDATED WITH DETAILED LOGGING
// async function getTracksWithBPM(tracks, targetBPM, tolerance) {
//     const tracksWithBPM = [];
//     let noAudioFeatures = 0;
//     let successfulBatches = 0;
    
//     // Process in batches of 100 (Spotify API limit)
//     for (let i = 0; i < tracks.length; i += 100) {
//         const batch = tracks.slice(i, i + 100);
//         const ids = batch.map(t => t.id).filter(id => id).join(','); // Filter out null IDs
        
//         if (!ids) {
//             addDebugLog(`WARNING: Batch ${i}-${i+batch.length} has no valid track IDs`);
//             continue;
//         }
        
//         try {
//             addDebugLog(`Fetching audio features for batch ${i}-${i+batch.length}...`);
//             const response = await spotifyAPI(`v1/audio-features?ids=${ids}`);
            
//             successfulBatches++;
            
//             for (let j = 0; j < batch.length; j++) {
//                 if (response.audio_features[j] && response.audio_features[j].tempo) {
//                     const track = {
//                         ...batch[j],
//                         tempo: response.audio_features[j].tempo
//                     };
//                     tracksWithBPM.push(track);
                    
//                     // Log ALL tracks with their BPM for debugging
//                     const diff = Math.abs(track.tempo - targetBPM);
//                     const symbol = diff <= tolerance ? '✓' : (diff <= tolerance + 10 ? '○' : '✗');
//                     addDebugLog(`${symbol} "${track.name}" - ${track.tempo.toFixed(1)} BPM (diff: ${diff.toFixed(1)})`);
//                 } else {
//                     noAudioFeatures++;
//                     // Track without audio features
//                     tracksWithBPM.push({
//                         ...batch[j],
//                         tempo: null
//                     });
//                     if (batch[j]) {
//                         addDebugLog(`✗ "${batch[j].name}" - No BPM data available`);
//                     }
//                 }
//             }
//         } catch (error) {
//             console.error('Failed to get audio features for batch:', error);
//             addDebugLog(`ERROR: Failed batch ${i}-${i+batch.length}: ${error.message}`);
            
//             // Try to get more details about the error
//             if (error.message.includes('401')) {
//                 addDebugLog('ERROR: Authentication issue - you may need to log out and log in again');
//             } else if (error.message.includes('429')) {
//                 addDebugLog('ERROR: Rate limit exceeded - try again in a few seconds');
//             }
            
//             // Still add tracks without BPM data so we know what failed
//             for (let j = 0; j < batch.length; j++) {
//                 if (batch[j]) {
//                     tracksWithBPM.push({
//                         ...batch[j],
//                         tempo: null
//                     });
//                 }
//             }
//         }
        
//         updateProgress(
//             `Analyzing BPM... (${Math.min(i + 100, tracks.length)}/${tracks.length} tracks)`,
//             60 + (20 * (i + 100) / tracks.length)
//         );
//     }
    
//     addDebugLog(`\nAnalysis complete:`);
//     addDebugLog(`- Total tracks processed: ${tracksWithBPM.length}`);
//     addDebugLog(`- Successful API batches: ${successfulBatches}`);
//     addDebugLog(`- Tracks with BPM data: ${tracksWithBPM.filter(t => t.tempo).length}`);
//     addDebugLog(`- Tracks without BPM data: ${noAudioFeatures}`);
    
//     return tracksWithBPM;
// }

// async function getTracksWithBPM(tracks, targetBPM, tolerance) {
//   const tracksWithBPM = [];
//   let noAudioFeatures = 0;
//   let successfulBatches = 0;

//   for (let i = 0; i < tracks.length; i += 100) {
//     const batch = tracks.slice(i, i + 100);

//     // Request only real Spotify tracks with IDs
//     const requestables = batch.filter(
//       t => t && t.type === 'track' && !t.is_local && t.id
//     );
//     if (requestables.length === 0) {
//       batch.forEach(t => tracksWithBPM.push({ ...t, tempo: null }));
//       continue;
//     }

//     try {
//       addDebugLog(`Fetching audio features for batch ${i}-${i + requestables.length}...`);
//       const { audio_features } = await spotifyAPI(
//         `v1/audio-features?ids=${requestables.map(t => t.id).join(',')}`
//       );
//       successfulBatches++;

//       // Map features by ID (Spotify may return nulls)
//       const byId = new Map();
//       (audio_features || []).forEach(f => { if (f && f.id) byId.set(f.id, f); });

//       // Project features back onto the ORIGINAL batch order
//       batch.forEach(t => {
//         let tempo = null;
//         if (t && t.type === 'track' && !t.is_local && t.id) {
//           const f = byId.get(t.id);
//           if (f && typeof f.tempo === 'number') tempo = f.tempo;
//         }

//         tracksWithBPM.push({ ...t, tempo });

//         // detailed debug
//         if (t) {
//           const label = tempo == null ? '✗' : '✓';
//           const diff = tempo == null ? '—' : Math.abs(tempo - targetBPM).toFixed(1);
//           addDebugLog(`${label} "${t.name}" - ${tempo == null ? 'No BPM' : tempo.toFixed(1) + ' BPM'} (diff: ${diff})`);
//           if (tempo == null) noAudioFeatures++;
//         }
//       });
//     } catch (error) {
//       addDebugLog(`ERROR: Failed batch ${i}-${i + batch.length}: ${error.message}`);
//       batch.forEach(t => tracksWithBPM.push({ ...t, tempo: null }));
//     }

//     updateProgress(
//       `Analyzing BPM... (${Math.min(i + 100, tracks.length)}/${tracks.length} tracks)`,
//       60 + (20 * (i + 100) / tracks.length)
//     );
//   }

//   addDebugLog(`\nAnalysis complete:
// - Total tracks processed: ${tracksWithBPM.length}
// - Successful API batches: ${successfulBatches}
// - Tracks with BPM data: ${tracksWithBPM.filter(t => typeof t.tempo === 'number').length}
// - Tracks without BPM data: ${noAudioFeatures}`);

//   return tracksWithBPM;
// }


async function getTracksWithBPM(tracks, targetBPM, tolerance) {
  const tracksWithBPM = [];
  let successfulBatches = 0;
  let noAudioFeatures = 0;

  const MAX_IDS = 50; // keep URL short; avoids WAFs that 403 long queries

  for (let i = 0; i < tracks.length; i += MAX_IDS) {
    const batch = tracks.slice(i, i + MAX_IDS);

    // Only real Spotify tracks
    const requestables = batch.filter(t => t && t.type === 'track' && !t.is_local && t.id);
    if (!requestables.length) {
      batch.forEach(t => tracksWithBPM.push({ ...t, tempo: null }));
      continue;
    }

    const params = new URLSearchParams({ ids: requestables.map(t => t.id).join(',') });
    const endpoint = `v1/audio-features?${params}`;

    addDebugLog('Audio-features request', {
      window: `${i}-${i + requestables.length}`,
      ids: requestables.length,
      urlLength: (`https://api.spotify.com/${endpoint}`).length,
      sampleIds: [requestables[0].id, requestables.at(-1).id]
    });

    try {
      const { audio_features } = await spotifyAPI(endpoint);

      // Map by ID
      const byId = new Map();
      (audio_features || []).forEach(f => { if (f && f.id) byId.set(f.id, f); });

      batch.forEach(t => {
        let tempo = null;
        if (t && t.type === 'track' && !t.is_local && t.id) {
          const f = byId.get(t.id);
          if (f && typeof f.tempo === 'number') tempo = f.tempo;
        }
        tracksWithBPM.push({ ...t, tempo });
        if (tempo == null) noAudioFeatures++;
      });

      successfulBatches++;
    } catch (e) {
      addDebugLog(`Batch 403/failed for window ${i}-${i + requestables.length}: ${e.message}`);
      // Fallback: fetch features one-by-one (short URLs never hit the WAF)
      for (const t of batch) {
        let tempo = null;
        if (t && t.type === 'track' && !t.is_local && t.id) {
          try {
            const f = await spotifyAPI(`v1/audio-features/${t.id}`);
            if (f && typeof f.tempo === 'number') tempo = f.tempo;
            // tiny delay to be gentle; adjust if you hit 429s
            await new Promise(r => setTimeout(r, 25));
          } catch (singleErr) {
            addDebugLog(`Single feature fetch failed for ${t.id}: ${singleErr.message}`);
          }
        }
        tracksWithBPM.push({ ...t, tempo });
        if (tempo == null) noAudioFeatures++;
      }
    }

    updateProgress(
      `Analyzing BPM... (${Math.min(i + MAX_IDS, tracks.length)}/${tracks.length} tracks)`,
      60 + (20 * Math.min(i + MAX_IDS, tracks.length) / tracks.length)
    );
  }

  addDebugLog(`\nAnalysis complete:
- Total tracks processed: ${tracksWithBPM.length}
- Successful API batches: ${successfulBatches}
- Tracks with BPM data: ${tracksWithBPM.filter(t => typeof t.tempo === 'number').length}
- Tracks without BPM data: ${noAudioFeatures}`);

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
            </div>
            <span class="track-bpm">${Math.round(track.tempo)} BPM</span>
        `;
        trackList.appendChild(trackElement);
    });
    
    document.getElementById('results').classList.remove('hidden');
    
    // Store tracks for playlist creation
    window.matchingTracks = tracks;
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

// ============= Initialize =============
checkForToken();