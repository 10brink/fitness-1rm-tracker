# 1 Rep Max Tracker

A fitness tracking app for calculating one-rep max (1RM) and logging workouts. Syncs data across devices with Google authentication.

## Features

- **1RM Calculator** - Estimate your one-rep max from any set using rep-optimized formulas
- **Workout Logging** - Track exercises with sets, reps, weight, and date
- **Exercise Management** - Add custom exercises or use defaults (Squat, Bench Press, Deadlift, etc.)
- **Workout History** - View past workouts with PR indicators and percentage of max
- **Cloud Sync** - Data persists across devices via Firebase
- **Light/Dark Theme** - Toggle between themes with system preference detection

## 1RM Formulas

The calculator uses different formulas optimized for specific rep ranges:

| Rep Range | Formula | Best For |
|-----------|---------|----------|
| 1-5 reps | Epley | Heavy compound lifts |
| 6-10 reps | Brzycki | Moderate rep ranges |
| 11-15 reps | Lombardi | Higher rep sets |
| 16-20 reps | Mayhew | Endurance sets |

Exercise type (compound, dumbbell, machine) also influences formula selection for better accuracy.

## Tech Stack

- Vanilla HTML, CSS, JavaScript
- Firebase Authentication (Google Sign-In)
- Cloud Firestore (database)
- Google Fonts (Inter)

## Project Structure

```
fitness/
├── index.html      # Main page with 1RM calculator and history
├── workout.html    # Workout logging and exercise management
├── app.js          # Core application logic
└── style.css       # Styling with theme support
```

## Setup

1. Clone the repository
2. Replace Firebase config in `app.js` with your own project credentials
3. Enable Google Authentication in Firebase Console
4. Serve the files (any static file server works)

## Usage

1. Sign in with Google
2. Use the calculator to estimate 1RM from any recent set
3. Log workouts on the workout page
4. Track progress over time with workout history

## License

MIT
