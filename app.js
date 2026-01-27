/*
  Fitness 1RM Tracker - App Logic
  Handles Firebase authentication, workout logging, and 1RM calculations
  Uses Epley formula: weight × (1 + reps/30)
*/

// Firebase configuration - Replace with your own config from Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const app = document.getElementById('app');
const googleSigninBtn = document.getElementById('google-signin-btn');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');

const calcWeight = document.getElementById('calc-weight');
const calcReps = document.getElementById('calc-reps');
const calculateBtn = document.getElementById('calculate-btn');
const calcResult = document.getElementById('calc-result');
const resultValue = document.getElementById('result-value');

const exerciseSelect = document.getElementById('exercise-select');
const logWeight = document.getElementById('log-weight');
const logReps = document.getElementById('log-reps');
const saveWorkoutBtn = document.getElementById('save-workout-btn');

const newExerciseInput = document.getElementById('new-exercise-input');
const addExerciseBtn = document.getElementById('add-exercise-btn');
const exerciseList = document.getElementById('exercise-list');

const historyFilter = document.getElementById('history-filter');
const historyList = document.getElementById('history-list');

// Current user reference
let currentUser = null;
let userExercises = [];
let workoutLogs = [];
let bestOneRMs = {}; // Cache for best 1RMs per exercise

// ============================================
// Authentication
// ============================================

googleSigninBtn.addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error('Sign in error:', error);
    alert('Failed to sign in. Please try again.');
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
  }
});

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    userName.textContent = user.displayName || user.email;
    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');
    await loadUserData();
  } else {
    currentUser = null;
    loginScreen.classList.remove('hidden');
    app.classList.add('hidden');
    clearAppState();
  }
});

function clearAppState() {
  userExercises = [];
  workoutLogs = [];
  bestOneRMs = {};
  exerciseList.innerHTML = '';
  exerciseSelect.innerHTML = '<option value="">Select exercise...</option>';
  historyFilter.innerHTML = '<option value="all">All Exercises</option>';
  historyList.innerHTML = '<p class="empty-state">No workouts logged yet</p>';
}

// ============================================
// Data Loading
// ============================================

async function loadUserData() {
  if (!currentUser) return;

  try {
    // Load exercises
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists && userDoc.data().exercises) {
      userExercises = userDoc.data().exercises;
    } else {
      // Initialize with default exercises
      userExercises = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Barbell Row'];
      await saveExercises();
    }
    renderExercises();
    updateExerciseDropdowns();

    // Load workout logs
    await loadWorkoutLogs();
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

async function loadWorkoutLogs() {
  if (!currentUser) return;

  try {
    const logsSnapshot = await db
      .collection('users')
      .doc(currentUser.uid)
      .collection('logs')
      .orderBy('date', 'desc')
      .limit(100)
      .get();

    workoutLogs = logsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate best 1RMs for each exercise
    calculateBestOneRMs();
    renderHistory();
  } catch (error) {
    console.error('Error loading workout logs:', error);
  }
}

function calculateBestOneRMs() {
  bestOneRMs = {};
  workoutLogs.forEach(log => {
    const exercise = log.exercise;
    const oneRM = log.calculatedOneRM;
    if (!bestOneRMs[exercise] || oneRM > bestOneRMs[exercise]) {
      bestOneRMs[exercise] = oneRM;
    }
  });
}

// ============================================
// 1RM Calculator
// ============================================

function calculateOneRM(weight, reps) {
  // Epley formula: weight × (1 + reps/30)
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

calculateBtn.addEventListener('click', () => {
  const weight = parseFloat(calcWeight.value);
  const reps = parseInt(calcReps.value);

  if (!weight || weight <= 0) {
    alert('Please enter a valid weight');
    return;
  }

  if (!reps || reps < 1 || reps > 30) {
    alert('Please enter reps between 1 and 30');
    return;
  }

  const oneRM = calculateOneRM(weight, reps);
  resultValue.textContent = oneRM.toFixed(1);
  calcResult.classList.remove('hidden');
});

// Also calculate on Enter key
calcWeight.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') calculateBtn.click();
});
calcReps.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') calculateBtn.click();
});

// ============================================
// Workout Logging
// ============================================

saveWorkoutBtn.addEventListener('click', async () => {
  const exercise = exerciseSelect.value;
  const weight = parseFloat(logWeight.value);
  const reps = parseInt(logReps.value);

  if (!exercise) {
    alert('Please select an exercise');
    return;
  }

  if (!weight || weight <= 0) {
    alert('Please enter a valid weight');
    return;
  }

  if (!reps || reps < 1) {
    alert('Please enter valid reps');
    return;
  }

  const calculatedOneRM = calculateOneRM(weight, reps);

  try {
    const logRef = await db
      .collection('users')
      .doc(currentUser.uid)
      .collection('logs')
      .add({
        exercise,
        weight,
        reps,
        calculatedOneRM,
        date: firebase.firestore.FieldValue.serverTimestamp()
      });

    // Add to local state
    const newLog = {
      id: logRef.id,
      exercise,
      weight,
      reps,
      calculatedOneRM,
      date: new Date()
    };

    workoutLogs.unshift(newLog);

    // Update best 1RM if needed
    if (!bestOneRMs[exercise] || calculatedOneRM > bestOneRMs[exercise]) {
      bestOneRMs[exercise] = calculatedOneRM;
    }

    renderHistory();

    // Clear inputs
    logWeight.value = '';
    logReps.value = '';

    // Show brief success feedback
    saveWorkoutBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveWorkoutBtn.textContent = 'Save Workout';
    }, 1500);
  } catch (error) {
    console.error('Error saving workout:', error);
    alert('Failed to save workout. Please try again.');
  }
});

// ============================================
// Exercise Management
// ============================================

async function saveExercises() {
  if (!currentUser) return;

  try {
    await db.collection('users').doc(currentUser.uid).set({
      exercises: userExercises
    }, { merge: true });
  } catch (error) {
    console.error('Error saving exercises:', error);
  }
}

function renderExercises() {
  exerciseList.innerHTML = '';

  userExercises.forEach(exercise => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="exercise-name">${exercise}</span>
      <button class="delete-btn" data-exercise="${exercise}" title="Delete exercise">&times;</button>
    `;
    exerciseList.appendChild(li);
  });

  // Add delete event listeners
  exerciseList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => removeExercise(btn.dataset.exercise));
  });
}

function updateExerciseDropdowns() {
  // Update exercise select dropdown
  exerciseSelect.innerHTML = '<option value="">Select exercise...</option>';
  userExercises.forEach(exercise => {
    const option = document.createElement('option');
    option.value = exercise;
    option.textContent = exercise;
    exerciseSelect.appendChild(option);
  });

  // Update history filter dropdown
  historyFilter.innerHTML = '<option value="all">All Exercises</option>';
  userExercises.forEach(exercise => {
    const option = document.createElement('option');
    option.value = exercise;
    option.textContent = exercise;
    historyFilter.appendChild(option);
  });
}

addExerciseBtn.addEventListener('click', async () => {
  const name = newExerciseInput.value.trim();

  if (!name) {
    alert('Please enter an exercise name');
    return;
  }

  if (userExercises.includes(name)) {
    alert('Exercise already exists');
    return;
  }

  userExercises.push(name);
  userExercises.sort();
  await saveExercises();
  renderExercises();
  updateExerciseDropdowns();
  newExerciseInput.value = '';
});

newExerciseInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addExerciseBtn.click();
});

async function removeExercise(name) {
  if (!confirm(`Remove "${name}" from your exercises?`)) return;

  userExercises = userExercises.filter(e => e !== name);
  await saveExercises();
  renderExercises();
  updateExerciseDropdowns();
}

// ============================================
// History Display
// ============================================

function formatDate(date) {
  if (!date) return '';

  // Handle Firestore Timestamp
  if (date.toDate) {
    date = date.toDate();
  }

  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

function calculatePercentOfMax(currentOneRM, exercise) {
  const best = bestOneRMs[exercise];
  if (!best || best === 0) return 100;
  return (currentOneRM / best) * 100;
}

function renderHistory() {
  const filter = historyFilter.value;
  const filteredLogs = filter === 'all'
    ? workoutLogs
    : workoutLogs.filter(log => log.exercise === filter);

  if (filteredLogs.length === 0) {
    historyList.innerHTML = '<p class="empty-state">No workouts logged yet</p>';
    return;
  }

  historyList.innerHTML = filteredLogs.map(log => {
    const percentOfMax = calculatePercentOfMax(log.calculatedOneRM, log.exercise);
    const isPR = log.calculatedOneRM === bestOneRMs[log.exercise];

    return `
      <div class="history-item">
        <div class="exercise-info">
          <span class="exercise-name">${log.exercise}${isPR ? ' 🏆' : ''}</span>
          <span class="workout-details">${log.weight} lbs × ${log.reps} reps</span>
          <span class="date">${formatDate(log.date)}</span>
        </div>
        <div class="stats">
          <span class="one-rm">${log.calculatedOneRM.toFixed(1)} lbs</span>
          <span class="percent-max">${percentOfMax.toFixed(0)}% of PR</span>
        </div>
      </div>
    `;
  }).join('');
}

historyFilter.addEventListener('change', renderHistory);
