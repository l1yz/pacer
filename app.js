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


async function getTracksWithBPM(tracks, targetBPM, tolerance) {
  const tracksWithBPM = [];
  let noAudioFeatures = 0;
  let successCount = 0;

  // LIMIT TO FIRST 30 TRACKS FOR DEBUGGING
  const DEBUG_LIMIT = 10;
  const tracksToProcess = tracks.slice(0, DEBUG_LIMIT);
  
  addDebugLog('--- Analyzing BPM using ReccoBeats batch API ---');
  addDebugLog(`Processing first ${tracksToProcess.length} tracks out of ${tracks.length} total...`);

  // Use exact headers from official documentation
  const myHeaders = new Headers();
  myHeaders.append("Accept", "application/json");

  const requestOptions = {
    method: "GET",
    headers: myHeaders,
    redirect: "follow"
  };

  // Process in batches (let's try smaller batches first)
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < tracksToProcess.length; i += BATCH_SIZE) {
    const batch = tracksToProcess.slice(i, i + BATCH_SIZE);
    const validTracks = batch.filter(track => track && track.id);
    
    if (validTracks.length === 0) {
      // Add all tracks in this batch as null tempo
      batch.forEach(track => tracksWithBPM.push({ ...track, tempo: null }));
      noAudioFeatures += batch.length;
      continue;
    }

    try {
      // Clean the track IDs - remove any spotify: prefix if present
      const trackIds = validTracks.map(track => track.id.replace('spotify:track:', ''));
      
      // Create URL with ids parameter
      const url = new URL('https://api.reccobeats.com/v1/audio-features');
      url.searchParams.append('ids', trackIds.join(','));

      addDebugLog(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: Requesting ${validTracks.length} tracks`);
      addDebugLog(`Track IDs: ${trackIds.join(', ')}`);
      addDebugLog(`Full URL: ${url.toString()}`);

      const response = await fetch(url.toString(), requestOptions);
      
      addDebugLog(`Response status: ${response.status} ${response.statusText}`);

      // Get response as text first to see exactly what we're getting
      const responseText = await response.text();
      addDebugLog(`Raw response text:`, responseText);

      if (!response.ok) {
        addDebugLog(`❌ Batch API error: ${response.status} ${response.statusText}`);
        addDebugLog(`Response body: ${responseText}`);
        
        // Add all tracks in this batch as null tempo
        batch.forEach(track => tracksWithBPM.push({ ...track, tempo: null }));
        noAudioFeatures += batch.length;
        continue;
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        addDebugLog(`Parsed JSON response:`, data);
      } catch (parseError) {
        addDebugLog(`❌ JSON parse error: ${parseError.message}`);
        
        // Add all tracks in this batch as null tempo
        batch.forEach(track => tracksWithBPM.push({ ...track, tempo: null }));
        noAudioFeatures += batch.length;
        continue;
      }

      // The response should be an array of audio features or an object with audio_features array
      const audioFeatures = Array.isArray(data) ? data : (data.content || data.audio_features || data.features || []);
      
      addDebugLog(`Raw data type: ${typeof data}, is array: ${Array.isArray(data)}`);
      addDebugLog(`Audio features array length: ${audioFeatures.length}`);
      addDebugLog(`First audio feature sample:`, audioFeatures[0]);

      // Map features back to tracks by index (order should match request order)
      batch.forEach((track, batchIndex) => {
        if (!track || !track.id) {
          tracksWithBPM.push({ ...track, tempo: null });
          noAudioFeatures++;
          return;
        }

        // Find the corresponding audio feature by valid track index
        const validTrackIndex = validTracks.findIndex(vt => vt.id === track.id);
        let audioFeature = null;
        
        if (validTrackIndex >= 0 && validTrackIndex < audioFeatures.length) {
          audioFeature = audioFeatures[validTrackIndex];
        }

        addDebugLog(`Track "${track.name}": batchIndex=${batchIndex}, validTrackIndex=${validTrackIndex}, audioFeature exists=${!!audioFeature}`);
        if (audioFeature) {
          addDebugLog(`  Audio feature for "${track.name}":`, audioFeature);
        }

        const tempo = audioFeature?.tempo || audioFeature?.bpm || null;

        if (tempo && typeof tempo === 'number' && tempo > 0) {
          tracksWithBPM.push({ ...track, tempo: tempo });
          successCount++;
          const diff = Math.abs(tempo - targetBPM);
          const symbol = diff <= tolerance ? '✅' : '⭕';
          addDebugLog(`${symbol} "${track.name}" - ${tempo.toFixed(1)} BPM (diff: ${diff.toFixed(1)})`);
        } else {
          tracksWithBPM.push({ ...track, tempo: null });
          noAudioFeatures++;
          addDebugLog(`❌ No BPM for "${track.name}" (got: ${tempo})`);
          if (audioFeature) {
            addDebugLog(`Audio feature object:`, audioFeature);
          }
        }
      });

      // Add delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      addDebugLog(`❌ Batch fetch error: ${error.message}`);
      
      // Add all tracks in this batch as null tempo
      batch.forEach(track => tracksWithBPM.push({ ...track, tempo: null }));
      noAudioFeatures += batch.length;
    }

    // Update progress
    updateProgress(
      `Analyzing BPM... (${Math.min(i + BATCH_SIZE, tracksToProcess.length)}/${tracksToProcess.length} tracks)`,
      60 + (20 * Math.min(i + BATCH_SIZE, tracksToProcess.length) / tracksToProcess.length)
    );
  }

  addDebugLog(`\n📊 Analysis Summary:`);
  addDebugLog(`- Tracks processed: ${tracksToProcess.length}`);
  addDebugLog(`- Tracks with BPM data: ${successCount}`);
  addDebugLog(`- Tracks without BPM data: ${noAudioFeatures}`);
  addDebugLog(`- Success rate: ${tracksToProcess.length > 0 ? (successCount/tracksToProcess.length*100).toFixed(1) : 0}%`);

  // Add remaining tracks as null tempo
  const remainingTracks = tracks.slice(DEBUG_LIMIT);
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