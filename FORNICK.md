# FORNICK.md - Fitness 1RM Tracker

## What This Is

A two-page webapp for tracking your lifts and calculating your one-rep max (1RM). Think of it as a digital training log that follows you to any gym, on any device.

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
        sets: 3,
        weight: 225,
        reps: 5,
        calculatedOneRM: 262.5,
        date: Timestamp
      }
```

Each user gets their own document with:
- An array of their custom exercises
- A subcollection of workout logs (now includes sets)

## The Math: Category-Aware 1RM Formulas

The app uses different formulas based on **both** rep range **and** exercise type. This matters because a barbell squat and a machine leg press don't follow the same strength curve.

### Exercise Categories

| Category | Examples | Why Different |
|----------|----------|---------------|
| **Compound Barbell** | Squat, Bench, Deadlift | Most studied, standard formulas apply |
| **Dumbbell Compounds** | DB Press, DB Rows | Stabilization demand changes the curve |
| **Machines & Smith** | Leg Press, Smith Squat | Fixed path = different fatigue pattern |

### Formula Selection Matrix

**Compound Barbell Lifts:**
| Reps | Formula | Notes |
|------|---------|-------|
| 1-3 | None (use actual weight) | Too few reps to estimate accurately |
| 4-10 | Epley | Gold standard for strength work |
| 11-20 | Mayhew | Better for higher rep sets |
| 21+ | Brzycki (inverse) | Capped, endurance territory |

**Dumbbell Compounds:**
| Reps | Formula |
|------|---------|
| 1-8 | Epley |
| 9-20 | Mayhew |
| 21+ | Brzycki |

**Machines & Smith:**
| Reps | Formula |
|------|---------|
| 1-10 | Brzycki |
| 11-15 | Mayhew |
| 16+ | Brzycki |

### The Formulas

```javascript
// Epley: weight × (1 + reps/30)
// Best for low-rep compound lifts

// Brzycki: weight × (36 / (37 - reps))
// More conservative, good for machines

// Lombardi: weight × (reps ^ 0.10)
// Moderate rep ranges

// Mayhew: 100 × weight / (52.2 + 41.9 × e^(-0.055 × reps))
// Handles high-rep sets well
```

### Rep Max Table

After calculating 1RM, the app shows what you should lift for 5, 10, 15, 20, and 25 reps using the inverse of the selected formula. This keeps the curve consistent—no jarring jumps between formulas.

## File Structure

```
fitness/
├── index.html      # 1RM calculator + workout history
├── workout.html    # Workout logging + exercise management
├── app.js          # All logic: auth, Firestore, calculations, themes
├── style.css       # Light/dark themes, mobile-first responsive
├── README.md       # GitHub readme
└── FORNICK.md      # You are here
```

### index.html
- Login screen (shown when signed out)
- Theme toggle button (sun/moon icons)
- 1RM Calculator with exercise type dropdown
- Workout history with PR indicators
- Link to workout logging page

### workout.html
- Workout logging form (exercise, date, sets, weight, reps)
- Edit/delete existing workouts
- Exercise management (add/remove custom exercises)
- Same history view as index, but with edit controls

### style.css
- CSS custom properties for theming
- **Two themes**: Dark (default) and Light
- System preference detection (`prefers-color-scheme`)
- Theme persists in localStorage
- Mobile-first: large touch targets, readable fonts

### app.js
The brain of the operation:
- Firebase initialization and auth state management
- Theme toggle with localStorage persistence
- Category-aware 1RM calculation
- CRUD operations for exercises and workout logs
- Edit mode for updating existing logs
- History rendering with PR detection (🏆)
- Caches best 1RMs per exercise for instant % calculations

## Key Code Patterns

### Theme Toggle
```javascript
function getPreferredTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}
```
Checks localStorage first, falls back to system preference. Theme stored on `<html>` element as data attribute.

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

### Edit Mode Pattern
```javascript
let editingLogId = null;

function enterEditMode(logId) {
  editingLogId = logId;
  // Populate form with existing data
  // Change button text to "Update"
  // Show cancel button
}

function exitEditMode() {
  editingLogId = null;
  // Reset form and UI
}
```
Single variable tracks whether we're creating or updating. The save button checks this to decide between `add()` and `update()`.

### Firestore Writes with Optimistic UI
```javascript
// Add to Firestore
const logRef = await db.collection('users')...add(data);

// Immediately update local state
workoutLogs.unshift(newLog);
renderHistory();
```
We don't wait for Firestore to confirm—the UI updates instantly. If Firebase is offline, it queues the write and syncs later.

### PR Detection
After loading all logs, we build a lookup table of best 1RMs:
```javascript
bestOneRMs = {}; // { "Bench Press": 275, "Squat": 315, ... }
```
Each history entry checks if it matches the best—if so, it gets a 🏆.

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
- Simplicity: 4 files, no build step, no node_modules bloat
- Speed: Loads instantly, no JavaScript bundle to parse
- Maintainability: Any web developer can read vanilla HTML/CSS/JS
- For an app this size, React/Vue would be overkill

### Why Two Pages Instead of One?
Originally single-page, but splitting made sense:
- **index.html**: Quick reference (calculator + history)
- **workout.html**: Active logging session (form + exercise management)

At the gym, you're either checking numbers or logging sets—rarely both at once.

### Why Light/Dark Theme?
- Gym lighting varies wildly (bright commercial gym vs. dim garage)
- Some people prefer light mode, period
- System preference detection = works out of the box for most users

### Why Client-Side Only?
No server means:
- Zero hosting cost (static files are free everywhere)
- No backend to maintain
- Scales to any number of users (Firebase handles it)

## Lessons Learned

### Category Matters for Formulas
Early version used Epley for everything. Users noticed machine exercises felt "off"—their actual 1RM was lower than predicted. Research confirmed: different movement patterns = different fatigue curves. Adding exercise categories improved accuracy noticeably.

### Edit Mode Complexity
Adding edit functionality seemed simple but touched everything:
- Form needs to toggle between "Save" and "Update"
- Need a cancel button (only in edit mode)
- History items need edit/delete buttons
- Deleting while editing that item = exit edit mode first

State management in vanilla JS requires discipline. One `editingLogId` variable controls the whole flow.

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
- **PWA**: Add to home screen, work fully offline

## The One Thing That Would Break This

Firebase config exposed in client-side code. This is fine because:
1. Firestore security rules protect data (users can only access their own)
2. The API key is restricted to your domain
3. Firebase is designed for client-side use

But if you skip the security rules setup, anyone could read/write any user's data. **Always set up proper Firestore rules before sharing the app.**
