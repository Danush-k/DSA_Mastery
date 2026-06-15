import { auth, db } from '../firebaseClient.js';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
  deleteDoc
} from 'firebase/firestore';
import useProgressStore from '../store/useProgressStore.js';
import useNotesStore from '../store/useNotesStore.js';
import useRevisionStore from '../store/useRevisionStore.js';

let isHydrating = false;
let authUser = null;

// Initialize synchronization listeners
export function initDbSync(onStatusChange) {
  if (!auth || !db) {
    if (onStatusChange) onStatusChange('local-only', null);
    return;
  }

  // Notify loading state immediately
  if (onStatusChange) onStatusChange('loading', null);

  // Listen for Firebase Authentication state changes
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      authUser = user;
      if (onStatusChange) onStatusChange('syncing', user);
      await hydrateFromCloud(user);
      if (onStatusChange) onStatusChange('synced', user);
    } else {
      authUser = null;
      if (onStatusChange) onStatusChange('unauthenticated', null);
    }
  });

  // Subscribe to local useProgressStore changes
  useProgressStore.subscribe(async (state, prevState) => {
    if (isHydrating || !authUser) return;

    const activeProfileId = state.activeProfileId;
    const profile = state.profiles[activeProfileId];
    const prevProfile = prevState.profiles[activeProfileId];
    if (!profile) return;

    // 1. Sync custom questions changes
    if (JSON.stringify(profile.customQuestions) !== JSON.stringify(prevProfile?.customQuestions)) {
      await syncCustomQuestions(profile.customQuestions);
    }

    // 2. Sync question status (solved, etc.) and bookmarks
    const statusKeys = Object.keys(profile.questionStatus);
    const prevStatusKeys = Object.keys(prevProfile?.questionStatus || {});
    const bookmarks = profile.bookmarks || [];
    const prevBookmarks = prevProfile?.bookmarks || [];

    const allKeys = [...new Set([...statusKeys, ...prevStatusKeys, ...bookmarks, ...prevBookmarks])];
    
    for (const qId of allKeys) {
      const numId = parseInt(qId);
      if (isNaN(numId)) continue;
      const status = profile.questionStatus[numId] || null;
      const prevStatus = prevProfile?.questionStatus?.[numId] || null;
      const bookmarked = bookmarks.includes(numId);
      const prevBookmarked = prevBookmarks.includes(numId);

      if (status !== prevStatus || bookmarked !== prevBookmarked) {
        const docId = `${authUser.uid}_${numId}`;
        await setDoc(doc(db, 'user_progress', docId), {
          uid: authUser.uid,
          questionId: numId,
          status,
          bookmarked,
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 3. Sync profile metadata changes (avatar, name, streak, dailySolves, solveHistory)
    const allProfileKeys = Object.keys(state.profiles);
    for (const key of allProfileKeys) {
      const p = state.profiles[key];
      const prevP = prevState.profiles[key];
      if (!p) continue;

      const metaChanged =
        p.name !== prevP?.name ||
        p.avatar !== prevP?.avatar ||
        p.currentStreak !== prevP?.currentStreak ||
        p.longestStreak !== prevP?.longestStreak ||
        p.lastSolveDate !== prevP?.lastSolveDate ||
        JSON.stringify(p.dailySolves) !== JSON.stringify(prevP?.dailySolves) ||
        JSON.stringify(p.solveHistory) !== JSON.stringify(prevP?.solveHistory);

      if (metaChanged) {
        const docRef = doc(db, 'users', authUser.uid);
        await setDoc(docRef, {
          name: p.name,
          avatar: p.avatar,
          currentStreak: p.currentStreak || 0,
          longestStreak: p.longestStreak || 0,
          lastSolveDate: p.lastSolveDate || null,
          dailySolves: p.dailySolves || {},
          solveHistory: (p.solveHistory || []).slice(0, 50),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }
  });

  // Subscribe to local useNotesStore changes
  useNotesStore.subscribe(async (state, prevState) => {
    if (isHydrating || !authUser) return;

    const activeProfileId = useProgressStore.getState().activeProfileId;
    const notes = state.profiles[activeProfileId] || {};
    const prevNotes = prevState.profiles[activeProfileId] || {};

    const allKeys = [...new Set([...Object.keys(notes), ...Object.keys(prevNotes)])];
    for (const qId of allKeys) {
      const numId = parseInt(qId);
      if (isNaN(numId)) continue;
      const noteData = notes[numId];
      const prevNoteData = prevNotes[numId];

      if (JSON.stringify(noteData) !== JSON.stringify(prevNoteData)) {
        const docId = `${authUser.uid}_${numId}`;
        await setDoc(doc(db, 'user_notes', docId), {
          uid: authUser.uid,
          questionId: numId,
          keyIdea: noteData?.keyIdea || '',
          mistakes: noteData?.mistakes || '',
          optimalApproach: noteData?.optimalApproach || '',
          timeComplexity: noteData?.timeComplexity || '',
          spaceComplexity: noteData?.spaceComplexity || '',
          notes: noteData?.notes || '',
          interviewLearnings: noteData?.interviewLearnings || '',
          note: noteData?.notes || '',
          code: noteData?.code || '',
          why: noteData?.why || '',
          googleDriveUrl: noteData?.googleDriveUrl || '',
          updatedAt: new Date().toISOString()
        });
      }
    }
  });

  // Subscribe to local useRevisionStore changes
  useRevisionStore.subscribe(async (state, prevState) => {
    if (isHydrating || !authUser) return;

    const activeProfileId = useProgressStore.getState().activeProfileId;
    const revisions = state.profiles[activeProfileId] || {};
    const prevRevisions = prevState.profiles[activeProfileId] || {};

    const allKeys = [...new Set([...Object.keys(revisions), ...Object.keys(prevRevisions)])];
    for (const qId of allKeys) {
      const numId = parseInt(qId);
      if (isNaN(numId)) continue;
      const rev = revisions[numId];
      const prevRev = prevRevisions[numId];

      if (JSON.stringify(rev) !== JSON.stringify(prevRev)) {
        const docId = `${authUser.uid}_${numId}`;
        if (!rev) {
          await deleteDoc(doc(db, 'user_revisions', docId));
        } else {
          await setDoc(doc(db, 'user_revisions', docId), {
            uid: authUser.uid,
            questionId: numId,
            revisionCount: rev?.revisionCount || 0,
            nextRevisionDate: rev?.nextRevisionDate || null,
            completed: rev?.completed || false,
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
  });
}

// Sync custom questions helper
async function syncCustomQuestions(customQuestions) {
  if (!authUser) return;
  
  for (const q of customQuestions) {
    const docId = `${authUser.uid}_${q.id}`;
    await setDoc(doc(db, 'custom_questions', docId), {
      uid: authUser.uid,
      id: q.id,
      num: q.num,
      title: q.title,
      url: q.url,
      videoUrl: q.videoUrl || null,
      difficulty: q.difficulty,
      topic: q.topic,
      pattern: q.pattern,
      importance: q.importance,
      why: q.why,
      companies: q.companies || [],
      createdAt: new Date().toISOString()
    });
  }
}

// Hydrate local store state from Firebase Firestore
async function hydrateFromCloud(user) {
  isHydrating = true;
  try {
    // 1. Fetch user profile doc
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    // 2. Fetch progress
    const progressQuery = query(collection(db, 'user_progress'), where('uid', '==', user.uid));
    const progressSnap = await getDocs(progressQuery);

    // 3. Fetch custom questions
    const customQuery = query(collection(db, 'custom_questions'), where('uid', '==', user.uid));
    const customSnap = await getDocs(customQuery);

    // 4. Fetch notes
    const notesQuery = query(collection(db, 'user_notes'), where('uid', '==', user.uid));
    const notesSnap = await getDocs(notesQuery);

    // 5. Fetch revisions
    const revisionsQuery = query(collection(db, 'user_revisions'), where('uid', '==', user.uid));
    const revisionsSnap = await getDocs(revisionsQuery);

    // Deep-clone current store states so React detects changes on setState
    const currentProgress = useProgressStore.getState();
    const progressStoreState = {
      activeProfileId: currentProgress.activeProfileId || 'default',
      profiles: {
        'default': {
          name: user.displayName || 'User',
          avatar: '🦊',
          questionStatus: {},
          dailySolves: {},
          bookmarks: [],
          currentStreak: 0,
          longestStreak: 0,
          lastSolveDate: null,
          customQuestions: [],
          solveHistory: []
        }
      }
    };

    const notesStoreState = {
      activeProfileId: 'default',
      profiles: {
        'default': {}
      }
    };

    const revisionStoreState = {
      activeProfileId: 'default',
      profiles: {
        'default': {}
      }
    };

    // Initialize local stores based on user doc
    if (userDocSnap.exists()) {
      const uData = userDocSnap.data();
      const p = progressStoreState.profiles['default'];
      p.name = uData.name || uData.username || user.displayName || 'User';
      p.avatar = uData.avatar || '🦊';
      p.currentStreak = uData.currentStreak || 0;
      p.longestStreak = uData.longestStreak || 0;
      p.lastSolveDate = uData.lastSolveDate || null;
      p.dailySolves = uData.dailySolves || {};
      p.solveHistory = uData.solveHistory || [];
    } else {
      // Save default local profile for new user
      const p = progressStoreState.profiles['default'];
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: user.displayName || 'User',
        email: user.email || '',
        name: p.name,
        avatar: p.avatar,
        currentStreak: p.currentStreak || 0,
        longestStreak: p.longestStreak || 0,
        lastSolveDate: p.lastSolveDate || null,
        dailySolves: p.dailySolves || {},
        solveHistory: p.solveHistory || [],
        updatedAt: new Date().toISOString()
      });
      // Also register username registry doc in case they signed up via OAuth and have a displayName
      if (user.displayName) {
        const usernameLower = user.displayName.toLowerCase();
        const usernameDocRef = doc(db, 'usernames', usernameLower);
        const usernameDoc = await getDoc(usernameDocRef);
        if (!usernameDoc.exists()) {
          await setDoc(usernameDocRef, { uid: user.uid });
        }
      }
    }

    // Hydrate progress (questionStatus + bookmarks)
    const reconstructedDailySolves = {};
    const reconstructedSolveHistory = [];

    progressSnap.forEach(docSnap => {
      const row = docSnap.data();
      const pk = 'default';

      if (row.status === 'solved') {
        progressStoreState.profiles[pk].questionStatus[row.questionId] = row.status;
        const dateStr = row.updatedAt ? row.updatedAt.split('T')[0] : null;
        if (dateStr) {
          reconstructedDailySolves[dateStr] = (reconstructedDailySolves[dateStr] || 0) + 1;
        }
        reconstructedSolveHistory.push({
          questionId: row.questionId,
          solvedAt: row.updatedAt || new Date().toISOString()
        });
      } else if (row.status) {
        progressStoreState.profiles[pk].questionStatus[row.questionId] = row.status;
      }

      if (row.bookmarked) {
        progressStoreState.profiles[pk].bookmarks.push(row.questionId);
      }
    });

    // Reconstruct / heal profile metadata to match questionStatus solves
    const profile = progressStoreState.profiles['default'];
    
    // Sort and slice history
    reconstructedSolveHistory.sort((a, b) => b.solvedAt.localeCompare(a.solvedAt));
    const slicedHistory = reconstructedSolveHistory.slice(0, 50);

    // Reconstruct streak based on daily solves
    const sortedDates = Object.keys(reconstructedDailySolves)
      .filter(date => reconstructedDailySolves[date] > 0)
      .sort();

    let lastSolveDate = null;
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];

    if (sortedDates.length > 0) {
      const lastDateStr = sortedDates[sortedDates.length - 1];
      const todayDate = new Date(today);
      const lastDate = new Date(lastDateStr);
      const diffTime = Math.abs(todayDate - lastDate);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        lastSolveDate = lastDateStr;
        currentStreak = 1;
        let checkDate = new Date(lastDate);
        while (true) {
          checkDate.setDate(checkDate.getDate() - 1);
          const checkDateStr = checkDate.toISOString().split('T')[0];
          if (reconstructedDailySolves[checkDateStr] > 0) {
            currentStreak++;
          } else {
            break;
          }
        }
      } else {
        lastSolveDate = lastDateStr;
        currentStreak = 0;
      }
    }

    profile.dailySolves = { ...reconstructedDailySolves };
    profile.solveHistory = slicedHistory;
    profile.currentStreak = currentStreak;
    profile.longestStreak = Math.max(profile.longestStreak || 0, currentStreak);
    profile.lastSolveDate = lastSolveDate;

    // Hydrate custom questions
    const customQs = [];
    customSnap.forEach(docSnap => {
      const row = docSnap.data();
      customQs.push({
        id: row.id,
        num: row.num,
        title: row.title,
        url: row.url,
        videoUrl: row.videoUrl || undefined,
        difficulty: row.difficulty,
        topic: row.topic,
        pattern: row.pattern,
        importance: row.importance,
        why: row.why,
        companies: row.companies || [],
        isCustom: true
      });
    });
    profile.customQuestions = customQs;

    // Hydrate notes
    notesSnap.forEach(docSnap => {
      const row = docSnap.data();
      notesStoreState.profiles['default'][row.questionId] = {
        keyIdea: row.keyIdea || '',
        mistakes: row.mistakes || '',
        optimalApproach: row.optimalApproach || '',
        timeComplexity: row.timeComplexity || '',
        spaceComplexity: row.spaceComplexity || '',
        notes: row.notes || row.note || '',
        interviewLearnings: row.interviewLearnings || '',
        code: row.code || '',
        why: row.why || '',
        googleDriveUrl: row.googleDriveUrl || '',
        updatedAt: row.updatedAt
      };
    });

    // Hydrate revisions
    revisionsSnap.forEach(docSnap => {
      const row = docSnap.data();
      
      // Only hydrate if the question is currently solved!
      const status = progressStoreState.profiles['default']?.questionStatus[row.questionId];
      if (status === 'solved') {
        revisionStoreState.profiles['default'][row.questionId] = {
          revisionCount: row.revisionCount,
          nextRevisionDate: row.nextRevisionDate,
          completed: row.completed
        };
      }
    });

    // Set updated Zustand store states
    useProgressStore.setState({ ...progressStoreState });
    useNotesStore.setState({ ...notesStoreState });
    useRevisionStore.setState({ ...revisionStoreState });

  } catch (err) {
    console.error("Hydration from Firebase Cloud failed:", err);
  } finally {
    isHydrating = false;
  }
}

// Delete all cloud data for a user (cascading deletion)
export async function deleteUserCloudData(user) {
  if (!db || !user) return;
  
  // 1. Get username for registry lookup doc
  let username = null;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      username = userDocSnap.data().username;
    }
  } catch (err) {
    console.error("Failed to retrieve username for deletion mapping:", err);
  }

  // 2. Delete the user's data documents in other collections by querying uid
  const collections = ['user_progress', 'user_notes', 'user_revisions', 'custom_questions'];
  for (const collName of collections) {
    try {
      const q = query(collection(db, collName), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      const deletePromises = [];
      snap.forEach((docSnap) => {
        deletePromises.push(deleteDoc(docSnap.ref));
      });
      await Promise.all(deletePromises);
    } catch (err) {
      console.error(`Failed to delete collection ${collName} for user:`, err);
    }
  }

  // 3. Delete user profile doc
  try {
    await deleteDoc(doc(db, 'users', user.uid));
  } catch (err) {
    console.error("Failed to delete user document:", err);
  }

  // 4. Delete username reservation registry doc
  if (username) {
    try {
      await deleteDoc(doc(db, 'usernames', username.toLowerCase()));
    } catch (err) {
      console.error(`Failed to delete username mapping for ${username}:`, err);
    }
  }
}

// Clear all local Zustand store caches and localStorage entries
export function clearAllLocalStores() {
  useProgressStore.getState().clearStore();
  useNotesStore.getState().clearStore();
  useRevisionStore.getState().clearStore();
  localStorage.removeItem('dsa-progress-v2');
  localStorage.removeItem('dsa-notes-v2');
  localStorage.removeItem('dsa-revisions-v2');
  localStorage.removeItem('dsa-google-auth-v1');
}
