# Spotify BPM Pacer WebApp

A web application that analyzes your Spotify music library to find songs matching a target BPM for jogging/walking, with visual metronome functionality.

## Features

- 🎵 Spotify OAuth integration with PKCE authentication
- 📊 BPM analysis of your Spotify Liked Songs or entire playlists
- 🎯 Customizable target BPM and tolerance settings
- 📋 Real-time progress tracking and detailed debug logging
- 📥 CSV export of BPM analysis results
- 🎼 Automatic playlist creation in Spotify

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Authentication**: Spotify Web API with PKCE flow
- **BPM Analysis**: ReccoBeats API
- **Styling**: Modern glassmorphism design with Spotify theme

## Setup Process

### 1. Spotify App Configuration
- Create app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- Add your domain (e.g., ngrok URL) to redirect URIs
- Copy Client ID to `app.js`

### 2. Authentication Flow
- **Initial issue**: Spotify deprecated implicit grant flow (`response_type=token`)
- **Solution**: Implemented Authorization Code with PKCE flow
- Uses `response_type=code` with code verifier/challenge for security

### 3. BPM Analysis Evolution

#### First Attempt: Spotify Audio Features API
- **Problem**: Spotify disabled the `/v1/audio-features` endpoint
- **Result**: All requests returned 403/404 errors

#### Second Attempt: ReccoBeats Single Track API  
- **Endpoint**: `/v1/track/:id/audio-features`
- **Problem**: Requires ReccoBeats UUIDs, not Spotify track IDs
- **Result**: 404 errors for all Spotify IDs

#### Final Solution: ReccoBeats Batch API
- **Endpoint**: `/v1/audio-features?ids=spotifyId1,spotifyId2`
- **Key insight**: Batch endpoint accepts Spotify track IDs directly
- **Response structure**: `{"content": [{"tempo": 140.131, ...}, ...]}`
- **Success**: Now extracts BPM data correctly

## Current Implementation

### Core Functions
- `spotifyAPI()` - Handles Spotify Web API calls with detailed error logging
- `getLikedSongs()` - Fetches user's liked songs with pagination
- `getTracksWithBPM()` - Batch BPM analysis using ReccoBeats API
- `showResults()` - Displays matching tracks and creates playlists

### Debug Features
- Real-time logging of API requests/responses
- Track-by-track BPM analysis results
- CSV export functionality
- Success rate reporting

## Usage

1. **Connect**: Click "Connect with Spotify" and authorize
2. **Configure**: Set target BPM (default: 120) and tolerance (±5)
3. **Analyze**: Choose "Liked Songs Only" or "All Playlists"
4. **Results**: View matching tracks and create playlist
5. **Export**: Download CSV report of all analyzed tracks

## Key Learnings

- Spotify's audio features endpoint is no longer available
- ReccoBeats API has different endpoints with different ID requirements
- Modern OAuth requires PKCE for client-side applications
- Batch processing significantly improves API efficiency
- Proper error handling and debugging is crucial for API integration

## Files

- `index.html` - Main interface with controls and results display
- `style.css` - Responsive design with Spotify branding
- `app.js` - Core application logic and API integrations