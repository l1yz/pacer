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

  // STEP 1: Get ReccoBeats track IDs from Spotify IDs (batch)
  addDebugLog('=== STEP 1: Getting ReccoBeats track IDs ===');
  const trackIdMapping = new Map(); // spotifyId -> reccoBeatId
  const BATCH_SIZE = 40;
  
  for (let i = 0; i < tracksToProcess.length; i += BATCH_SIZE) {
    const batch = tracksToProcess.slice(i, i + BATCH_SIZE);
    const validTracks = batch.filter(track => track && track.id);
    
    if (validTracks.length === 0) {
      continue;
    }

    try {
      // Clean the track IDs - remove any spotify: prefix if present
      const trackIds = validTracks.map(track => track.id.replace('spotify:track:', ''));
      
      // Create URL with ids parameter for batch ID lookup
      const url = new URL('https://api.reccobeats.com/v1/audio-features');
      url.searchParams.append('ids', trackIds.join(','));

      addDebugLog(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: Getting ReccoBeats IDs for ${validTracks.length} tracks`);
      addDebugLog(`Spotify Track Names: ${validTracks.map(t => t.name).join(', ')}`);

      const response = await fetch(url.toString(), requestOptions);
      
      if (!response.ok) {
        addDebugLog(`❌ Batch ID lookup error: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const features = Array.isArray(data) ? data : (data.content || data.audio_features || data.features || []);
      
      addDebugLog(`Got ${features.length} ReccoBeats IDs for ${validTracks.length} Spotify tracks`);
      
      // Map Spotify IDs to ReccoBeats IDs for Step 2
      features.forEach((feature, index) => {
        if (index < validTracks.length && feature.id) {
          const spotifyId = validTracks[index].id;
          const spotifyName = validTracks[index].name;
          const reccoBeatId = feature.id;
          trackIdMapping.set(spotifyId, reccoBeatId);
          addDebugLog(`✓ Mapped "${spotifyName}" -> ReccoBeats ID: ${reccoBeatId}`);
        }
      });

      // Add delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      addDebugLog(`❌ Batch fetch error: ${error.message}`);
    }

    // Update progress
    updateProgress(
      `Getting ReccoBeats IDs... (${Math.min(i + BATCH_SIZE, tracksToProcess.length)}/${tracksToProcess.length} tracks)`,
      40 + (20 * Math.min(i + BATCH_SIZE, tracksToProcess.length) / tracksToProcess.length)
    );
  }

  addDebugLog(`=== ID MAPPING COMPLETE: ${trackIdMapping.size} tracks mapped ===`);

  // STEP 2: Get detailed audio features using ReccoBeats IDs (individual calls)
  addDebugLog('=== STEP 2: Getting detailed audio features ===');
  
  for (let i = 0; i < tracksToProcess.length; i++) {
    const track = tracksToProcess[i];
    
    if (!track || !track.id) {
      tracksWithBPM.push({ ...track, tempo: null });
      noAudioFeatures++;
      continue;
    }

    const reccoBeatId = trackIdMapping.get(track.id);
    if (!reccoBeatId) {
      tracksWithBPM.push({ ...track, tempo: null });
      noAudioFeatures++;
      addDebugLog(`❌ No ReccoBeats ID found for "${track.name}"`);
      continue;
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
        continue;
      }

      const audioFeature = await response.json();
      addDebugLog(`✓ Got detailed features for "${track.name}":`, audioFeature);

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

      // Add delay between individual calls (shorter than batch delay)
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      addDebugLog(`❌ Error fetching features for "${track.name}": ${error.message}`);
      tracksWithBPM.push({ ...track, tempo: null });
      noAudioFeatures++;
    }

    // Update progress
    const processed = i + 1;
    updateProgress(
      `Getting audio features... (${processed}/${tracksToProcess.length} tracks)`,
      60 + (20 * processed / tracksToProcess.length)
    );
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
            <span class="track-bpm">${Math.round(track.tempo)} BPM</span>
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
        const wasPlaying = this.isPlaying;
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
                
                // Auto-calibrate if auto-sync is enabled and track is playing
                if (beatDetector.audioStream && this.isPlaying && !beatDetector.isListening) {
                    setTimeout(() => {
                        addDebugLog(`Track changed to: ${track.name} - starting auto-calibration`);
                        beatDetector.startCalibration(track.id);
                    }, 2000); // Wait 2 seconds for track to fully start
                }
            }
        }
        
        // Update UI
        this.updateProgressBar();
        const button = document.getElementById('play-pause');
        button.textContent = this.isPlaying ? '⏸' : '▶';
        
        // Update metronome based on current track
        if (this.currentTrack) {
            this.updateTempoMode();
        }
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
        
        // Tempo mode change
        document.querySelectorAll('input[name="tempo-mode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateTempoMode();
            });
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
            addDebugLog(`Started Spotify playlist: ${this.playlist.length} tracks`);
            
        } catch (error) {
            addDebugLog(`Error starting playlist: ${error.message}`);
            alert('Failed to start playlist. Please try again.');
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
        document.getElementById('current-track-bpm').textContent = `${Math.round(track.tempo)} BPM`;
        document.getElementById('current-track-index').textContent = this.currentIndex + 1;
        
        // Update remaining time
        const remainingTracks = this.playlist.slice(this.currentIndex + 1);
        const remainingMs = remainingTracks.reduce((total, track) => total + (track.duration_ms || 180000), 0);
        document.getElementById('remaining-time').textContent = formatDuration(remainingMs);
        
        // Update metronome based on tempo mode
        this.updateTempoMode();
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
            
            if (this.isPlaying) {
                metronome.start();
            } else {
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
    
    updateTempoMode() {
        const currentTrack = this.playlist[this.currentIndex];
        if (!currentTrack) return;
        
        const tempoMode = document.querySelector('input[name="tempo-mode"]:checked').value;
        const targetBPM = parseInt(document.getElementById('target-bpm').value);
        
        if (tempoMode === 'adjust-song') {
            // Option 1: Adjust song tempo to target BPM
            const originalBPM = currentTrack.tempo;
            this.playbackRate = targetBPM / originalBPM;
            
            // NOTE: Spotify Web Playback SDK doesn't support tempo/pitch adjustment
            // This shows the calculated playback rate that would be needed
            addDebugLog(`Tempo calculation: ${originalBPM.toFixed(1)} → ${targetBPM} BPM (would need ${this.playbackRate.toFixed(2)}x rate)`);
            addDebugLog(`Note: Spotify API doesn't support tempo adjustment. Use metronome for pacing.`);
            
            metronome.setBPM(targetBPM);
        } else {
            // Option 2: Adjust metronome to song BPM (recommended)
            this.playbackRate = 1.0;
            metronome.setBPM(Math.round(currentTrack.tempo));
            addDebugLog(`Metronome set to match song: ${Math.round(currentTrack.tempo)} BPM`);
        }
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
        this.minBeatInterval = 300; // Min 300ms between beats (200 BPM max)
        this.lastBeatTime = 0;
        
        // Calibration settings
        this.calibrationDuration = 10000; // 10 seconds
        this.minBeatsRequired = 8; // Need at least 8 beats for good calibration
    }
    
    async requestAudioAccess() {
        try {
            addDebugLog('Requesting system audio access...');
            
            // Check if getDisplayMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                // Fallback: try getUserMedia for microphone (less ideal but might work)
                addDebugLog('getDisplayMedia not supported, trying microphone fallback...');
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
                    throw new Error('Neither system audio nor microphone access available');
                }
            } else {
                // Request system audio capture via screen sharing
                this.audioStream = await navigator.mediaDevices.getDisplayMedia({
                    video: false,
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        sampleRate: 44100
                    }
                });
            }
            
            // Check if we actually got audio
            const audioTracks = this.audioStream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error('No audio track received - make sure to check "Share audio" in the permission dialog');
            }
            
            addDebugLog(`Audio stream received: ${audioTracks.length} audio tracks`);
            
            // Set up audio analysis
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.analyser = this.audioContext.createAnalyser();
            
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.3;
            source.connect(this.analyser);
            
            addDebugLog('Audio capture initialized successfully');
            return true;
            
        } catch (error) {
            addDebugLog(`Audio capture failed: ${error.name} - ${error.message}`);
            
            // Provide specific guidance based on error type
            if (error.name === 'NotAllowedError') {
                alert('Audio access denied. Please:\n1. Click "Enable Auto-Sync" again\n2. In the permission dialog, check "Share audio"\n3. Click "Share" (not Cancel)');
            } else if (error.name === 'NotSupportedError') {
                alert('Audio capture not supported in this browser. Try Chrome or Firefox.');
            } else {
                alert(`Audio capture failed: ${error.message}`);
            }
            
            return false;
        }
    }
    
    startCalibration(trackId) {
        if (!this.analyser || this.isListening) return false;
        
        this.currentTrackId = trackId;
        this.detectedBeats = [];
        this.calibrationStartTime = Date.now();
        this.isListening = true;
        this.beatOffset = null;
        
        // Update UI
        document.getElementById('sync-status').classList.remove('hidden');
        document.getElementById('sync-progress').classList.add('listening');
        document.getElementById('sync-text').textContent = 'Listening for beats...';
        
        addDebugLog(`Starting beat calibration for track: ${trackId}`);
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
        
        // Calculate bass energy (kick drum range ~60-120Hz)
        let bassEnergy = 0;
        for (let i = this.bassFreqRange.min; i <= this.bassFreqRange.max; i++) {
            bassEnergy += frequencyData[i];
        }
        bassEnergy /= (this.bassFreqRange.max - this.bassFreqRange.min + 1);
        bassEnergy /= 255; // Normalize to 0-1
        
        // Simple beat detection: look for sudden increases in bass energy
        const currentTime = Date.now();
        if (bassEnergy > this.beatThreshold && 
            currentTime - this.lastBeatTime > this.minBeatInterval) {
            
            this.lastBeatTime = currentTime;
            return true;
        }
        
        return false;
    }
    
    stopCalibration() {
        this.isListening = false;
        document.getElementById('sync-progress').classList.remove('listening');
        
        if (this.detectedBeats.length < this.minBeatsRequired) {
            document.getElementById('sync-text').textContent = 
                `Not enough beats detected (${this.detectedBeats.length}/${this.minBeatsRequired}). Try increasing volume.`;
            
            setTimeout(() => {
                document.getElementById('sync-status').classList.add('hidden');
            }, 3000);
            
            addDebugLog(`Calibration failed: only ${this.detectedBeats.length} beats detected`);
            return false;
        }
        
        // Calculate beat offset
        this.calculateBeatOffset();
        
        document.getElementById('sync-text').textContent = 
            `✓ Synced! (${this.detectedBeats.length} beats analyzed)`;
        
        setTimeout(() => {
            document.getElementById('sync-status').classList.add('hidden');
        }, 2000);
        
        addDebugLog(`Calibration successful: ${this.detectedBeats.length} beats, offset: ${this.beatOffset}ms`);
        return true;
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
    
    cleanup() {
        this.isListening = false;
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

// Metronome class
class Metronome {
    constructor() {
        this.bpm = 120;
        this.isRunning = false;
        this.intervalId = null;
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
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
        
        document.getElementById('auto-sync-toggle').addEventListener('click', () => {
            this.toggleAutoSync();
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
        this.bpm = bpm;
        document.getElementById('metronome-bpm').textContent = `${bpm} BPM`;
        
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        document.getElementById('metronome-toggle').textContent = 'Stop Metronome';
        
        this.scheduleNextBeat();
    }
    
    scheduleNextBeat() {
        if (!this.isRunning) return;
        
        const interval = 60000 / this.bpm; // milliseconds per beat
        let nextBeatDelay = interval;
        
        // Apply phase offset for sync
        if (this.phase !== 0) {
            nextBeatDelay = interval - this.phase;
            this.phase = 0; // Reset after first adjusted beat
        }
        
        this.intervalId = setTimeout(() => {
            this.playBeat();
            this.visualBeat();
            
            // Schedule next beat with regular interval
            if (this.isRunning) {
                this.intervalId = setInterval(() => {
                    this.playBeat();
                    this.visualBeat();
                }, interval);
            }
        }, nextBeatDelay);
    }
    
    smoothTransitionToPhase(beatOffset, bpm) {
        if (!this.isRunning) {
            this.phase = beatOffset;
            return;
        }
        
        // Calculate smooth transition
        const interval = 60000 / bpm;
        const currentPhase = Date.now() % interval;
        const phaseDifference = (beatOffset - currentPhase + interval) % interval;
        
        // Avoid jarring transitions - only adjust if difference is significant
        if (Math.abs(phaseDifference) > 50 && Math.abs(phaseDifference) < interval - 50) {
            addDebugLog(`Smoothly adjusting metronome phase by ${phaseDifference.toFixed(1)}ms`);
            
            // Restart with new phase
            this.stop();
            this.phase = phaseDifference;
            this.start();
        } else {
            addDebugLog('Phase difference too small for smooth transition - keeping current timing');
        }
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        document.getElementById('metronome-toggle').textContent = 'Start Metronome';
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
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
        
        setTimeout(() => {
            beatElement.classList.remove('active');
        }, 150);
    }
}

// Initialize components
const beatDetector = new BeatDetector();
const audioPlayer = new AudioPlayer();
const metronome = new Metronome();

// ============= Initialize =============
checkForToken();