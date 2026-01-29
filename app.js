/*
  Fitness 1RM Tracker - App Logic
  Handles Firebase authentication, workout logging, and 1RM calculations
  Uses rep-optimized formulas: Epley (1-5), Brzycki (6-10), Lombardi (11-15), Mayhew (16-20)
*/

// ============================================
// Theme Toggle
// ============================================

const themeToggle = document.getElementById('theme-toggle');

function getPreferredTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

// Initialize theme
setTheme(getPreferredTheme());

// Toggle on click
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    setTheme(next);
  });
}

// Firebase configuration - Replace with your own config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAD6K8R7YfSYwZ99ex3UdZQ0e-HNWc9TqQ",
  authDomain: "juanrepmax.firebaseapp.com",
  projectId: "juanrepmax",
  storageBucket: "juanrepmax.firebasestorage.app",
  messagingSenderId: "84470709132",
  appId: "1:84470709132:web:e7fdd70686ab59f7a774a9"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements - Some may be null depending on which page we're on
const loginScreen = document.getElementById('login-screen');
const app = document.getElementById('app');
const googleSigninBtn = document.getElementById('google-signin-btn');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');

// Calculator elements (index.html only)
const calcWeight = document.getElementById('calc-weight');
const calcReps = document.getElementById('calc-reps');
const calcCategory = document.getElementById('calc-category');
const calculateBtn = document.getElementById('calculate-btn');
const calcResult = document.getElementById('calc-result');
const resultValue = document.getElementById('result-value');
const formulaValue = document.getElementById('formula-value');

// Workout logging elements (workout.html only)
const exerciseSelect = document.getElementById('exercise-select');
const logDate = document.getElementById('log-date');
const logSets = document.getElementById('log-sets');
const logWeight = document.getElementById('log-weight');
const logReps = document.getElementById('log-reps');
const saveWorkoutBtn = document.getElementById('save-workout-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const logSectionTitle = document.getElementById('log-section-title');

// Track edit mode
let editingLogId = null;

// Exercise management elements (workout.html only)
const newExerciseInput = document.getElementById('new-exercise-input');
const addExerciseBtn = document.getElementById('add-exercise-btn');
const exerciseList = document.getElementById('exercise-list');

// History elements (both pages)
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
  if (exerciseList) exerciseList.innerHTML = '';
  if (exerciseSelect) exerciseSelect.innerHTML = '<option value="">Select exercise...</option>';
  if (historyFilter) historyFilter.innerHTML = '<option value="all">All Exercises</option>';
  if (historyList) historyList.innerHTML = '<p class="empty-state">No workouts logged yet</p>';
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
  // Different formulas optimized for different rep ranges
  // Cap reps at 20 for high-rep sets
  if (reps > 20) reps = 20;

  if (reps === 1) {
    return weight;
  } else if (reps <= 5) {
    // Epley formula: weight × (1 + reps/30)
    return weight * (1 + reps / 30);
  } else if (reps <= 10) {
    // Brzycki formula: weight × (36 / (37 - reps))
    return weight * (36 / (37 - reps));
  } else if (reps <= 15) {
    // Lombardi formula: weight × (reps ^ 0.10)
    return weight * Math.pow(reps, 0.10);
  } else {
    // Mayhew formula: 100 × weight / (52.2 + 41.9 × e^(-0.055 × reps))
    return (100 * weight) / (52.2 + 41.9 * Math.exp(-0.055 * reps));
  }
}

function getFormulaKeyForReps(reps) {
  if (reps <= 5) return 'epley';
  if (reps <= 10) return 'brzycki';
  if (reps <= 15) return 'lombardi';
  return 'mayhew';
}

function getFormulaKeyForCategory(category, reps) {
  if (category === 'explosive') return 'lombardi';
  if (category === 'isolation') return 'mayhew';
  if (category === 'bench') return 'mayhew';

  if (reps >= 12) return 'epley';
  if (reps >= 4 && reps <= 8) return 'brzycki';
  if (reps > 8 && reps <= 12) return 'epley';

  return 'epley';
}

function getFormulaLabel(formulaKey) {
  if (formulaKey === 'epley') return 'Epley';
  if (formulaKey === 'brzycki') return 'Brzycki';
  if (formulaKey === 'lombardi') return 'Lombardi';
  return 'Mayhew';
}

function calculateOneRMWithFormula(weight, reps, category) {
  let cappedReps = reps > 20 ? 20 : reps;
  const formulaKey = category ? getFormulaKeyForCategory(category, cappedReps) : getFormulaKeyForReps(cappedReps);
  if (category === 'explosive' && cappedReps > 10) cappedReps = 10;
  return { oneRM: calculateOneRM(weight, cappedReps), formulaKey, cappedReps };
}

// Calculate weight for a given number of reps from a 1RM
// If formulaKey is provided, use that formula for all reps to keep the curve consistent.
function calculateWeightFromOneRM(oneRM, reps, formulaKey) {
  const key = formulaKey || getFormulaKeyForReps(reps);
  if (reps === 1) {
    return oneRM;
  }
  if (key === 'epley') {
    // Inverse Epley: weight = 1RM / (1 + reps/30)
    return oneRM / (1 + reps / 30);
  }
  if (key === 'brzycki') {
    // Inverse Brzycki: weight = 1RM × (37 - reps) / 36
    return oneRM * (37 - reps) / 36;
  }
  if (key === 'lombardi') {
    // Inverse Lombardi: weight = 1RM / (reps ^ 0.10)
    return oneRM / Math.pow(reps, 0.10);
  }
  // Inverse Mayhew: weight = 1RM × (52.2 + 41.9 × e^(-0.055 × reps)) / 100
  return oneRM * (52.2 + 41.9 * Math.exp(-0.055 * reps)) / 100;
}

if (calculateBtn) calculateBtn.addEventListener('click', () => {
  const weight = parseFloat(calcWeight.value);
  const reps = parseInt(calcReps.value);

  if (!weight || weight <= 0) {
    alert('Please enter a valid weight');
    return;
  }

  if (!reps || reps < 1) {
    alert('Please enter valid reps');
    return;
  }

  const { oneRM, formulaKey, cappedReps } = calculateOneRMWithFormula(weight, reps, calcCategory ? calcCategory.value : null);
  resultValue.textContent = oneRM.toFixed(1);
  if (formulaValue) {
    formulaValue.textContent = `${getFormulaLabel(formulaKey)}${cappedReps !== reps ? ` (capped at ${cappedReps} reps)` : ''}`;
  }

  // Calculate and display multiple rep maxes
  let repCounts = [2, 4, 6, 8, 10, 15];
  if (calcCategory && calcCategory.value === 'explosive') {
    repCounts = repCounts.filter(repCount => repCount <= 10);
  }
  const repMaxesContainer = document.getElementById('rep-maxes');
  repMaxesContainer.innerHTML = repCounts.map(repCount => {
    const repWeight = calculateWeightFromOneRM(oneRM, repCount, formulaKey);
    const percentage = (repWeight / oneRM) * 100;
    return `
      <div class="rep-max-item">
        <span class="rep-count">${repCount} Rep Max</span>
        <span class="rep-weight">${repWeight.toFixed(1)} lbs</span>
        <span class="rep-percent">${percentage.toFixed(0)}% of 1RM</span>
      </div>
    `;
  }).join('');

  calcResult.classList.remove('hidden');
});

// Also calculate on Enter key
if (calcWeight) calcWeight.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') calculateBtn.click();
});
if (calcReps) calcReps.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') calculateBtn.click();
});

// ============================================
// Workout Logging
// ============================================

// Initialize date input to today
if (logDate) {
  logDate.value = new Date().toISOString().split('T')[0];
}

if (saveWorkoutBtn) saveWorkoutBtn.addEventListener('click', async () => {
  const exercise = exerciseSelect.value;
  const dateValue = logDate.value;
  const sets = parseInt(logSets.value) || 1;
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
  const selectedDate = dateValue ? new Date(dateValue + 'T12:00:00') : new Date();

  try {
    if (editingLogId) {
      // Update existing log
      await db
        .collection('users')
        .doc(currentUser.uid)
        .collection('logs')
        .doc(editingLogId)
        .update({
          exercise,
          sets,
          weight,
          reps,
          calculatedOneRM,
          date: firebase.firestore.Timestamp.fromDate(selectedDate)
        });

      // Update local state
      const logIndex = workoutLogs.findIndex(log => log.id === editingLogId);
      if (logIndex !== -1) {
        workoutLogs[logIndex] = {
          ...workoutLogs[logIndex],
          exercise,
          sets,
          weight,
          reps,
          calculatedOneRM,
          date: selectedDate
        };
      }

      // Exit edit mode
      exitEditMode();

      // Show brief success feedback
      saveWorkoutBtn.textContent = 'Updated!';
    } else {
      // Create new log
      const logRef = await db
        .collection('users')
        .doc(currentUser.uid)
        .collection('logs')
        .add({
          exercise,
          sets,
          weight,
          reps,
          calculatedOneRM,
          date: firebase.firestore.Timestamp.fromDate(selectedDate)
        });

      // Add to local state
      const newLog = {
        id: logRef.id,
        exercise,
        sets,
        weight,
        reps,
        calculatedOneRM,
        date: selectedDate
      };

      workoutLogs.unshift(newLog);

      // Show brief success feedback
      saveWorkoutBtn.textContent = 'Saved!';
    }

    // Recalculate best 1RMs and re-sort
    workoutLogs.sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : a.date;
      const dateB = b.date?.toDate ? b.date.toDate() : b.date;
      return dateB - dateA;
    });
    calculateBestOneRMs();
    renderHistory();

    // Clear inputs
    logSets.value = '';
    logWeight.value = '';
    logReps.value = '';
    logDate.value = new Date().toISOString().split('T')[0];

    setTimeout(() => {
      saveWorkoutBtn.textContent = 'Save Workout';
    }, 1500);
  } catch (error) {
    console.error('Error saving workout:', error);
    alert('Failed to save workout. Please try again.');
  }
});

// Edit mode functions
function enterEditMode(logId) {
  const log = workoutLogs.find(l => l.id === logId);
  if (!log) return;

  editingLogId = logId;

  // Populate form with log data
  exerciseSelect.value = log.exercise;
  logSets.value = log.sets || 1;
  logWeight.value = log.weight;
  logReps.value = log.reps;

  // Set date
  const logDateObj = log.date?.toDate ? log.date.toDate() : log.date;
  if (logDateObj) {
    logDate.value = logDateObj.toISOString().split('T')[0];
  }

  // Update UI
  if (logSectionTitle) logSectionTitle.textContent = 'Edit Workout';
  if (saveWorkoutBtn) saveWorkoutBtn.textContent = 'Update Workout';
  if (cancelEditBtn) cancelEditBtn.classList.remove('hidden');

  // Scroll to form
  document.querySelector('.log-section')?.scrollIntoView({ behavior: 'smooth' });
}

function exitEditMode() {
  editingLogId = null;

  // Reset UI
  if (logSectionTitle) logSectionTitle.textContent = 'Log Workout';
  if (saveWorkoutBtn) saveWorkoutBtn.textContent = 'Save Workout';
  if (cancelEditBtn) cancelEditBtn.classList.add('hidden');

  // Clear form
  if (exerciseSelect) exerciseSelect.value = '';
  if (logSets) logSets.value = '';
  if (logWeight) logWeight.value = '';
  if (logReps) logReps.value = '';
  if (logDate) logDate.value = new Date().toISOString().split('T')[0];
}

if (cancelEditBtn) cancelEditBtn.addEventListener('click', exitEditMode);

// Delete log function
async function deleteLog(logId) {
  if (!confirm('Delete this workout entry?')) return;

  try {
    await db
      .collection('users')
      .doc(currentUser.uid)
      .collection('logs')
      .doc(logId)
      .delete();

    // Remove from local state
    workoutLogs = workoutLogs.filter(log => log.id !== logId);

    // Recalculate best 1RMs
    calculateBestOneRMs();
    renderHistory();

    // Exit edit mode if we were editing this log
    if (editingLogId === logId) {
      exitEditMode();
    }
  } catch (error) {
    console.error('Error deleting workout:', error);
    alert('Failed to delete workout. Please try again.');
  }
}

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
  if (!exerciseList) return;

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
  // Update exercise select dropdown (workout.html only)
  if (exerciseSelect) {
    exerciseSelect.innerHTML = '<option value="">Select exercise...</option>';
    userExercises.forEach(exercise => {
      const option = document.createElement('option');
      option.value = exercise;
      option.textContent = exercise;
      exerciseSelect.appendChild(option);
    });
  }

  // Update history filter dropdown (both pages)
  if (historyFilter) {
    historyFilter.innerHTML = '<option value="all">All Exercises</option>';
    userExercises.forEach(exercise => {
      const option = document.createElement('option');
      option.value = exercise;
      option.textContent = exercise;
      historyFilter.appendChild(option);
    });
  }
}

if (addExerciseBtn) addExerciseBtn.addEventListener('click', async () => {
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

if (newExerciseInput) newExerciseInput.addEventListener('keypress', (e) => {
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
  if (!historyList) return;

  const filter = historyFilter ? historyFilter.value : 'all';
  const filteredLogs = filter === 'all'
    ? workoutLogs
    : workoutLogs.filter(log => log.exercise === filter);

  if (filteredLogs.length === 0) {
    historyList.innerHTML = '<p class="empty-state">No workouts logged yet</p>';
    return;
  }

  // Check if we're on the workout page (has edit capability)
  const canEdit = !!document.getElementById('log-section-title');

  historyList.innerHTML = filteredLogs.map(log => {
    const percentOfMax = calculatePercentOfMax(log.calculatedOneRM, log.exercise);
    const isPR = log.calculatedOneRM === bestOneRMs[log.exercise];

    return `
      <div class="history-item">
        <div class="exercise-info">
          <span class="exercise-name">${log.exercise}${isPR ? ' 🏆' : ''}</span>
          <span class="workout-details">${log.sets || 1}×${log.reps} @ ${log.weight} lbs</span>
          <span class="date">${formatDate(log.date)}</span>
          ${canEdit ? `
            <div>
              <button class="edit-btn" data-id="${log.id}">Edit</button>
              <button class="delete-log-btn" data-id="${log.id}">Delete</button>
            </div>
          ` : ''}
        </div>
        <div class="stats">
          <span class="one-rm">${log.calculatedOneRM.toFixed(1)} lbs</span>
          <span class="percent-max">${percentOfMax.toFixed(0)}% of PR</span>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners for edit/delete buttons
  if (canEdit) {
    historyList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => enterEditMode(btn.dataset.id));
    });
    historyList.querySelectorAll('.delete-log-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteLog(btn.dataset.id));
    });
  }
}

if (historyFilter) historyFilter.addEventListener('change', renderHistory);
