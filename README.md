# Fitness 1RM Tracker

A simple web app for tracking your lifts and calculating your one-rep max. Log workouts at the gym, sync across devices, and track your progress over time.

## Features

- **1RM Calculator** - Enter weight and reps to get your estimated one-rep max
- **Multiple Rep Maxes** - See estimated weights for 2, 4, 6, 8, 10, and 15 rep maxes
- **Workout Logging** - Track sets, reps, and weight for each exercise
- **PR Detection** - Automatically highlights personal records
- **Cloud Sync** - Sign in with Google, access your data from any device
- **Mobile-First** - Designed for quick logging between sets

## 1RM Formulas

Uses rep-optimized formulas for more accurate estimates:

| Reps | Formula |
|------|---------|
| 1-5 | Epley |
| 6-10 | Brzycki |
| 11-15 | Lombardi |
| 16-20 | Mayhew |

## Tech Stack

- Vanilla HTML, CSS, JavaScript (no frameworks)
- Firebase Authentication (Google sign-in)
- Cloud Firestore (database)

## Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Google Authentication
3. Create a Firestore database
4. Add your Firebase config to `app.js`
5. Deploy to any static hosting (GitHub Pages, Netlify, etc.)

### Firestore Security Rules

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

## License

MIT
