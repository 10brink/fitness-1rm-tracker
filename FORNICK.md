# FORNICK.md - Fitness 1RM Tracker

## What This Is

A single-page webapp for tracking your lifts and calculating your one-rep max (1RM). Think of it as a digital training log that follows you to any gym, on any device.

## The Problem It Solves

You're at the gym, you just hit 225 for 5 reps on bench. You want to know:
1. What's my estimated 1RM from this set?
2. How does this compare to my best ever?
3. Is this progress or am I plateauing?

Scribbling in a notebook works, but it stays at home. Spreadsheets are clunky on your phone mid-set. This app gives you instant answers with one hand while you're still catching your breath.

## Technical Architecture

### The Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks, no build step)
- **Backend**: Firebase (Google's serverless platform)
  - **Authentication**: Google Sign-in
  - **Database**: Cloud Firestore (NoSQL)
- **Hosting**: Static files - can be hosted anywhere (GitHub Pages, Netlify, your own server)

### Why Firebase?
Cross-device sync without writing a backend. Sign in on your phone at the gym, log a set. Get home, open your laptop, and it's all there. Firebase handles:
- User accounts (via Google)
- Real-time database sync
- Offline support (Firestore caches locally)

### Data Model
```
users/{userId}/
  ├── exercises: ["Squat", "Bench Press", "Deadlift", ...]  // User's exercise list
  └── logs/{logId}: {
        exercise: "Bench Press",
        weight: 225,
        reps: 5,
        calculatedOneRM: 262.5,
        date: Timestamp
      }
```

Each user gets their own document with:
- An array of their custom exercises
- A subcollection of workout logs

## The Math: Epley Formula

The app uses the **Epley formula** to estimate 1RM:

```
1RM = weight × (1 + reps/30)
```

Example: You bench 225 lbs for 5 reps
- 1RM = 225 × (1 + 5/30)
- 1RM = 225 × 1.167
- 1RM = **262.5 lbs**

Why Epley? It's simple, widely used, and reasonably accurate for 1-10 reps. Other formulas exist (Brzycki, Lombardi), but Epley is the gym standard.

**Caveat**: These formulas get less accurate above 10 reps. A 20-rep set gives you endurance info, not max strength estimates. The app allows up to 30 reps but the sweet spot is 1-10.

## File Structure

```
fitness/
├── index.html      # Single page structure + Firebase SDK imports
├── style.css       # Dark theme, mobile-first responsive
├── app.js          # All logic: auth, Firestore, calculations
└── FORNICK.md      # You are here
```

### index.html
- Login screen (shown when signed out)
- Main app container (shown when signed in)
- Sections: Calculator, Log Workout, Manage Exercises, History
- Imports Firebase SDK from CDN (compat version for simpler syntax)

### style.css
- CSS custom properties (variables) for theming
- Dark theme: deep navy background, red accent (#e94560)
- Mobile-first: large touch targets (48px minimum), big text
- No CSS framework - just clean, minimal styles

### app.js
The brain of the operation:
- Firebase initialization and auth state management
- CRUD operations for exercises and workout logs
- 1RM calculation using Epley formula
- History rendering with PR detection
- Caches best 1RMs per exercise for instant % calculations

## Key Code Patterns

### Auth State Machine
```javascript
auth.onAuthStateChanged((user) => {
  if (user) {
    // Show app, load data
  } else {
    // Show login, clear state
  }
});
```
Firebase calls this whenever auth state changes. One listener handles everything.

### Firestore Writes with Optimistic UI
```javascript
// Add to Firestore
const logRef = await db.collection('users')...add(data);

// Immediately update local state
workoutLogs.unshift(newLog);
renderHistory();
```
We don't wait for Firestore to confirm - the UI updates instantly, assuming success. If Firebase is offline, it queues the write and syncs later.

### PR Detection
After loading all logs, we build a lookup table of best 1RMs:
```javascript
bestOneRMs = {}; // { "Bench Press": 275, "Squat": 315, ... }
```
Each history entry checks if it matches the best - if so, it gets a 🏆.

## Setup Instructions

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (disable Google Analytics if you want, not needed)
3. Click "Authentication" → "Get Started" → Enable "Google" provider
4. Click "Firestore Database" → "Create database" → Start in test mode
5. Go to Project Settings → Your apps → Add web app
6. Copy the config object into `app.js` (replace the placeholder)

### Firestore Security Rules (Production)
For real use, update your Firestore rules to:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
This ensures users can only access their own data.

## Design Decisions

### Why No Framework?
- Simplicity: 3 files, no build step, no node_modules
- Speed: Loads instantly, no JavaScript bundle to parse
- Maintainability: Any web developer can read vanilla HTML/CSS/JS
- For a single-page app this size, React/Vue would be overkill

### Why Dark Theme?
- Gym lighting is often harsh - dark UI is easier on the eyes
- Looks more "modern" for a fitness app
- Red accent pops against dark background

### Why Client-Side Only?
No server means:
- Zero hosting cost (static files are free everywhere)
- No backend to maintain
- Scales to any number of users (Firebase handles it)

## Lessons Learned

### Firestore Timestamps
Firestore stores timestamps as special `Timestamp` objects, not JavaScript `Date`s. Always check:
```javascript
if (date.toDate) {
  date = date.toDate();
}
```

### Mobile Input UX
- Removed number spinners (those tiny arrows are useless on mobile)
- Added `inputmode="numeric"` for better mobile keyboards
- Large tap targets (minimum 48px) for sweaty gym fingers

### The 100-Log Limit
We limit history to 100 most recent entries. Could paginate, but for a personal training log, 100 recent sets is plenty. Going back further means analyzing trends, which is a different feature.

## Future Ideas (Not Implemented)

- **Charts**: Show 1RM progress over time per exercise
- **Workout Templates**: "Leg Day" preset that queues exercises
- **Rest Timer**: Countdown between sets
- **Export**: Download data as CSV
- **PWA**: Add to home screen, work offline

## The One Thing That Would Break This

Firebase config exposed in client-side code. This is fine because:
1. Firestore security rules protect data (users can only access their own)
2. The API key is restricted to your domain
3. Firebase is designed for client-side use

But if you skip the security rules setup, anyone could read/write any user's data. **Always set up proper Firestore rules before sharing the app.**
