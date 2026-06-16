import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  StickyNote,
  X,
  Sparkles,
  Target,
  Clock,
  Layers,
  AlertTriangle,
  Info,
  Heading,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Eye,
  Maximize2,
  Minimize2,
  FolderOpen,
  ExternalLink,
  UploadCloud,
  CloudUpload,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  FileImage,
  ChevronLeft,
  File,
  FileText,
  Users,
  UserPlus,
  Trash2
} from 'lucide-react';
import useNotesStore from '../../store/useNotesStore.js';
import { useGoogleAuthStore } from '../../store/useGoogleAuthStore.js';
import { getOrCreateFolder, uploadFileToFolder, getFilesInFolder } from '../../utils/googleDrive.js';
import { renderMarkdown } from '../../utils/markdown.js';

import { auth, db } from '../../firebaseClient.js';
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';

export default function NotesModal({ question, onClose, isConcept = false, concept = null, peerOwnerUid = null, peerOwnerUsername = null }) {
  const noteId = isConcept ? `concept_${concept.patternId}` : question.id;
  const topicName = isConcept ? (concept.topicName || 'General') : (question.topic || 'General');
  const folderName = isConcept ? (concept.patternName || 'Concept') : `${question.num || ''}. ${question.title || 'Untitled'}`;

  const saveNote = useNotesStore((s) => s.saveNote);
  const existingNote = useNotesStore((s) => s.profiles[s.activeProfileId]?.[noteId]);
  const existing = existingNote || {};

  // Google Auth integration
  const accessToken = useGoogleAuthStore((s) => s.accessToken);
  const isAuthorized = useGoogleAuthStore((s) => s.isAuthorized);
  const setAccessToken = useGoogleAuthStore((s) => s.setAccessToken);

  const [form, setForm] = useState({
    keyIdea: existing.keyIdea || '',
    mistakes: existing.mistakes || '',
    optimalApproach: existing.optimalApproach || '',
    timeComplexity: existing.timeComplexity || '',
    spaceComplexity: existing.spaceComplexity || '',
    notes: existing.notes || '',
    interviewLearnings: existing.interviewLearnings || '',
    googleDriveUrl: existing.googleDriveUrl || '',
  });

  // Peer view state overriding
  const [currentPeerUid, setCurrentPeerUid] = useState(peerOwnerUid);
  const [currentPeerUsername, setCurrentPeerUsername] = useState(peerOwnerUsername);
  const [loadingPeerNote, setLoadingPeerNote] = useState(!!peerOwnerUid);

  useEffect(() => {
    if (!currentPeerUid) return;

    const fetchPeerNote = async () => {
      setLoadingPeerNote(true);
      try {
        const docRef = doc(db, 'user_notes', `${currentPeerUid}_${noteId}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setForm({
            keyIdea: data.keyIdea || '',
            mistakes: data.mistakes || '',
            optimalApproach: data.optimalApproach || '',
            timeComplexity: data.timeComplexity || '',
            spaceComplexity: data.spaceComplexity || '',
            notes: data.notes || data.note || '',
            interviewLearnings: data.interviewLearnings || '',
            googleDriveUrl: data.googleDriveUrl || '',
          });
          setUrlInput(data.googleDriveUrl || '');
        }
      } catch (err) {
        console.error("Failed to fetch peer note:", err);
      } finally {
        setLoadingPeerNote(false);
      }
    };

    fetchPeerNote();
  }, [currentPeerUid, noteId]);

  // States for viewing a peer's notes inline within the Shared tab
  const [selectedPeerForView, setSelectedPeerForView] = useState(null);
  const [peerForm, setPeerForm] = useState(null);
  const [loadingPeerNotesTab, setLoadingPeerNotesTab] = useState(false);
  const [peerFolderFiles, setPeerFolderFiles] = useState([]);
  const [isLoadingPeerFiles, setIsLoadingPeerFiles] = useState(false);
  const [peerSelectedFile, setPeerSelectedFile] = useState(null);
  const [peerActiveSubTab, setPeerActiveSubTab] = useState('notes'); // 'notes' | 'details' | 'googleDrive'

  // Peer note fetching effect for inline Shared tab view
  useEffect(() => {
    if (!selectedPeerForView) {
      setPeerForm(null);
      setPeerFolderFiles([]);
      setPeerSelectedFile(null);
      return;
    }

    const fetchPeerNoteForTab = async () => {
      setLoadingPeerNotesTab(true);
      try {
        const docRef = doc(db, 'user_notes', `${selectedPeerForView.uid}_${noteId}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const pForm = {
            keyIdea: data.keyIdea || '',
            mistakes: data.mistakes || '',
            optimalApproach: data.optimalApproach || '',
            timeComplexity: data.timeComplexity || '',
            spaceComplexity: data.spaceComplexity || '',
            notes: data.notes || data.note || '',
            interviewLearnings: data.interviewLearnings || '',
            googleDriveUrl: data.googleDriveUrl || '',
          };
          setPeerForm(pForm);

          // If they have a google drive folder URL, we can attempt to list files if the current user has authorized GDrive
          if (pForm.googleDriveUrl && pForm.googleDriveUrl.includes('folders') && isAuthorized) {
            setIsLoadingPeerFiles(true);
            try {
              const folderMatch = pForm.googleDriveUrl.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9-_]+)/);
              if (folderMatch) {
                const files = await getFilesInFolder(folderMatch[1], accessToken);
                setPeerFolderFiles(files);
              }
            } catch (err) {
              console.error("Failed to list peer folder files:", err);
            } finally {
              setIsLoadingPeerFiles(false);
            }
          }
        } else {
          setPeerForm({
            keyIdea: '',
            mistakes: '',
            optimalApproach: '',
            timeComplexity: '',
            spaceComplexity: '',
            notes: '',
            interviewLearnings: '',
            googleDriveUrl: '',
          });
        }
      } catch (err) {
        console.error("Failed to fetch peer note for tab:", err);
      } finally {
        setLoadingPeerNotesTab(false);
      }
    };

    fetchPeerNoteForTab();
  }, [selectedPeerForView, noteId, isAuthorized, accessToken]);

  const [urlInput, setUrlInput] = useState(existing.googleDriveUrl || '');
  const [activeTab, setActiveTab] = useState('notes'); // Default tab is Notes
  const [isPreview, setIsPreview] = useState(!!peerOwnerUid);
  const [isMaximized, setIsMaximized] = useState(false);
  const textareaRef = useRef(null);

  // Drive integration UI states
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const [gDriveError, setGDriveError] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  // Native files list states
  const [folderFiles, setFolderFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Share note with peer states
  const [shareUsername, setShareUsername] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [shareSuccess, setShareSuccess] = useState(null);
  const [outboundShares, setOutboundShares] = useState([]);
  const [peerShares, setPeerShares] = useState([]);

  // Real-time listener for outbound shares
  useEffect(() => {
    if (currentPeerUid || !auth.currentUser) return;
    const q = query(
      collection(db, 'shared_notes_access'),
      where('ownerUid', '==', auth.currentUser.uid),
      where('noteId', '==', noteId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setOutboundShares(list);
    });
    return unsub;
  }, [noteId, currentPeerUid]);

  // Real-time listener for peer shared notes (inbound accepted) for this topic
  useEffect(() => {
    if (currentPeerUid || !auth.currentUser) return;
    const q = query(
      collection(db, 'shared_notes_access'),
      where('recipientUid', '==', auth.currentUser.uid),
      where('noteId', '==', noteId),
      where('status', '==', 'accepted')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data());
      });
      setPeerShares(list);
    });
    return unsub;
  }, [noteId, currentPeerUid]);

  const handleShare = async (e) => {
    e.preventDefault();
    const targetUsername = shareUsername.trim();
    if (!targetUsername) return;

    const authUser = auth.currentUser;
    if (!authUser) {
      setShareError("You must be logged in to share notes.");
      return;
    }

    setIsSharing(true);
    setShareError(null);
    setShareSuccess(null);

    try {
      // 1. Resolve username to UID
      const usernameLower = targetUsername.toLowerCase();
      const userRef = doc(db, 'usernames', usernameLower);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setShareError(`Username "${targetUsername}" does not exist.`);
        setIsSharing(false);
        return;
      }

      const recipientUid = userSnap.data().uid;

      if (recipientUid === authUser.uid) {
        setShareError("You cannot share notes with yourself.");
        setIsSharing(false);
        return;
      }

      // 2. Fetch sender's username
      let senderUsername = authUser.displayName || 'Anonymous';
      const senderDocRef = doc(db, 'users', authUser.uid);
      const senderDocSnap = await getDoc(senderDocRef);
      if (senderDocSnap.exists()) {
        senderUsername = senderDocSnap.data().username || senderUsername;
      }

      // 3. Create access record
      const shareDocId = `${noteId}_${recipientUid}`;
      const shareRef = doc(db, 'shared_notes_access', shareDocId);
      await setDoc(shareRef, {
        noteId,
        ownerUid: authUser.uid,
        ownerUsername: senderUsername,
        recipientUid,
        recipientUsername: targetUsername,
        status: 'pending',
        sharedAt: new Date().toISOString(),
        isConcept,
        questionNum: isConcept ? null : question.num,
        title: isConcept ? concept.patternName : question.title,
        topicName: topicName
      });

      setShareSuccess(`Shared note invitation sent to @${targetUsername}!`);
      setShareUsername('');
    } catch (err) {
      console.error("Failed to share note:", err);
      setShareError(`Failed to share note: ${err.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeShare = async (shareId) => {
    try {
      const shareRef = doc(db, 'shared_notes_access', shareId);
      await deleteDoc(shareRef);
    } catch (err) {
      console.error("Failed to revoke share:", err);
    }
  };

  const tokenClientRef = useRef(null);

  useEffect(() => {
    // Run expiry check on mount
    useGoogleAuthStore.getState().checkExpiry();
  }, []);

  useEffect(() => {
    if (window.google && !tokenClientRef.current) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse) => {
          setIsConnecting(false);
          if (tokenResponse.error_description) {
            setGDriveError(`Auth failed: ${tokenResponse.error_description}`);
            return;
          }
          if (tokenResponse.access_token) {
            setAccessToken(tokenResponse.access_token);
            setGDriveError(null);
          }
        },
        error_callback: (err) => {
          setIsConnecting(false);
          setGDriveError(`OAuth client error: ${err.message}`);
        }
      });

      // Auto-reconnect on mount if token is expired/absent and folder is linked
      const expired = useGoogleAuthStore.getState().checkExpiry();
      if (expired && form.googleDriveUrl && form.googleDriveUrl.includes('folders')) {
        setIsConnecting(true);
        tokenClientRef.current.requestAccessToken({ prompt: '' });
      }
    }
  }, [setAccessToken, form.googleDriveUrl]);

  // Fetch files when folder is connected or changed
  useEffect(() => {
    if (isAuthorized && form.googleDriveUrl && form.googleDriveUrl.includes('folders')) {
      fetchFiles();
    }
  }, [isAuthorized, form.googleDriveUrl, accessToken]);

  const getFolderIdFromUrl = (url) => {
    if (!url) return null;
    const match = url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const fetchFiles = async (urlOverride) => {
    const targetUrl = urlOverride || form.googleDriveUrl;
    const folderId = getFolderIdFromUrl(targetUrl);
    if (!folderId || !accessToken) return;

    setIsLoadingFiles(true);
    setGDriveError(null);
    try {
      const files = await getFilesInFolder(folderId, accessToken);
      setFolderFiles(files);
    } catch (err) {
      console.error("Failed to list files:", err);
      setGDriveError(`Failed to load folder contents: ${err.message}`);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleConnectGDrive = () => {
    if (tokenClientRef.current) {
      setIsConnecting(true);
      setGDriveError(null);
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    } else {
      setGDriveError("Google OAuth client script failed to load. Please make sure you are online or try refreshing the page.");
    }
  };

  const handleAutoCreateFolder = async () => {
    if (!accessToken) return;
    setIsCreatingFolder(true);
    setGDriveError(null);
    try {
      // 1. Get or Create "DSA Mastery" Root Folder
      const rootFolder = await getOrCreateFolder('DSA Mastery', null, accessToken);
      
      // 2. Get or Create Topic Folder
      const topicFolder = await getOrCreateFolder(topicName, rootFolder.id, accessToken);
      
      // 3. Get or Create Folder (Concept or Problem)
      const targetFolder = await getOrCreateFolder(folderName, topicFolder.id, accessToken);

      const folderUrl = `https://drive.google.com/drive/folders/${targetFolder.id}`;
      setForm((prev) => ({
        ...prev,
        googleDriveUrl: folderUrl
      }));
      setUrlInput(folderUrl);
      fetchFiles(folderUrl);
    } catch (err) {
      console.error("Auto-create folder failed:", err);
      setGDriveError(`Auto-folder creation failed: ${err.message}`);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const getEmbeddableDriveUrl = (url) => {
    if (!url) return '';
    const folderMatch = url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9-_]+)/);
    if (folderMatch) {
      return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
    }
    const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (fileMatch) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }
    const docMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/);
    if (docMatch) {
      return `https://docs.google.com/document/d/${docMatch[1]}/preview`;
    }
    const sheetMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetMatch) {
      return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/preview`;
    }
    const slideMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9-_]+)/);
    if (slideMatch) {
      return `https://docs.google.com/presentation/d/${slideMatch[1]}/embed`;
    }
    return url;
  };

  const getDriveTypeLabel = (url) => {
    if (!url) return 'Document';
    if (url.includes('document')) return 'Google Doc';
    if (url.includes('spreadsheets')) return 'Google Sheet';
    if (url.includes('presentation')) return 'Google Slide';
    if (url.includes('folders')) return 'Google Drive Folder';
    return 'Google Drive File';
  };

  const handleEmbed = () => {
    if (urlInput.trim() !== '') {
      setForm((prev) => ({
        ...prev,
        googleDriveUrl: urlInput.trim()
      }));
    }
  };

  const handleDisconnect = () => {
    setUrlInput('');
    setSelectedFile(null);
    setFolderFiles([]);
    setForm((prev) => ({
      ...prev,
      googleDriveUrl: ''
    }));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleUploadFiles(e.target.files);
    }
  };

  const handleUploadFiles = async (filesList) => {
    const folderId = getFolderIdFromUrl(form.googleDriveUrl);
    if (!folderId || !accessToken) {
      setGDriveError("Google Drive is not linked or not authorized.");
      return;
    }
    setGDriveError(null);
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      setUploadingFiles((prev) => ({ ...prev, [file.name]: 'uploading' }));
      try {
        await uploadFileToFolder(file, folderId, accessToken);
        setUploadingFiles((prev) => ({ ...prev, [file.name]: 'success' }));
        setTimeout(() => {
          setUploadingFiles((prev) => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
        }, 3000);
        // Refresh native file explorer list
        fetchFiles();
        setIframeKey((prev) => prev + 1);
      } catch (err) {
        console.error("Upload failed for file: " + file.name, err);
        setUploadingFiles((prev) => ({ ...prev, [file.name]: 'error' }));
        setGDriveError(`Upload failed for ${file.name}: ${err.message}`);
      }
    }
  };

  const handleSave = () => {
    saveNote(noteId, form);
    onClose();
  };

  const insertMarkdown = (type) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (type) {
      case 'bold':
        replacement = `**${selectedText || 'bold text'}**`;
        cursorOffset = selectedText ? 0 : 2;
        break;
      case 'italic':
        replacement = `*${selectedText || 'italic text'}*`;
        cursorOffset = selectedText ? 0 : 1;
        break;
      case 'heading':
        replacement = `### ${selectedText || 'Heading'}`;
        break;
      case 'quote':
        replacement = `> ${selectedText || 'Blockquote'}`;
        break;
      case 'code':
        replacement = `\`\`\`javascript\n${selectedText || '// code here'}\n\`\`\``;
        break;
      case 'ul':
        replacement = `\n- ${selectedText || 'List item'}`;
        break;
      case 'ol':
        replacement = `\n1. ${selectedText || 'List item'}`;
        break;
      case 'link':
        replacement = `[${selectedText || 'link text'}](https://example.com)`;
        break;
      case 'image':
        replacement = `![${selectedText || 'image alt'}](https://example.com/image.png)`;
        break;
      default:
        return;
    }

    const newText = text.substring(0, start) + replacement + text.substring(end);
    setForm((prev) => ({
      ...prev,
      [activeTab]: newText,
    }));

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + replacement.length - cursorOffset;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal ${isMaximized ? 'maximized' : ''}`} 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          ...(isMaximized ? {} : { maxWidth: '720px' }), 
          position: 'relative',
          overflow: showUploadPanel ? 'hidden' : 'auto'
        }}
      >
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StickyNote size={18} style={{ color: 'var(--accent-primary)' }} />
              {currentPeerUid 
                ? `${isConcept ? 'Concept Notes' : 'Notes'} (Shared by @${currentPeerUsername})`
                : (isConcept ? 'Concept Notes Editor' : 'Notes Editor')
              }
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {isConcept ? `Topic: ${topicName} | Concept: ${folderName}` : `${question.num}. ${question.title}`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal"><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          {loadingPeerNote ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', padding: '60px 0' }}>
              <RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Loading @{currentPeerUsername}'s notes...</span>
            </div>
          ) : (
            <div className="notes-form" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Note Fields Tabs & Complexity Inline */}
            <div className="notes-tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '4px', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
                {[
                  { id: 'notes', label: 'Notes', icon: StickyNote },
                  { id: 'keyIdea', label: 'Key Idea', icon: Sparkles },
                  { id: 'optimalApproach', label: 'Optimal Approach', icon: Target },
                  { id: 'mistakes', label: 'Mistakes', icon: AlertTriangle },
                  { id: 'interviewLearnings', label: 'Learnings', icon: Info },
                  { id: 'googleDrive', label: 'Google Drive', icon: FolderOpen },
                  ...(!currentPeerUid ? [{ id: 'collab', label: 'Shared', icon: Users }] : []),
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`notes-tab-btn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsPreview(false);
                        
                        // Auto-reconnect if token is expired when switching to Google Drive tab
                        if (tab.id === 'googleDrive') {
                          const expired = useGoogleAuthStore.getState().checkExpiry();
                          if (expired && form.googleDriveUrl && form.googleDriveUrl.includes('folders') && tokenClientRef.current) {
                            setIsConnecting(true);
                            tokenClientRef.current.requestAccessToken({ prompt: '' });
                          }
                        }
                      }}
                      style={{ paddingBottom: '6px' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon size={13} />
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Inline Complexity Fields */}
              {currentPeerUid ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', paddingBottom: '4px' }}>
                  {/* Time Capsule (Read-only) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(139, 92, 246, 0.08)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '100px',
                    padding: '4px 12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}>
                    <Clock size={12} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Time:</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {form.timeComplexity || 'N/A'}
                    </span>
                  </div>

                  {/* Space Capsule (Read-only) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '100px',
                    padding: '4px 12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}>
                    <Layers size={12} style={{ color: 'var(--accent-secondary)' }} />
                    <span style={{ fontSize: 11, color: 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Space:</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {form.spaceComplexity || 'N/A'}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', paddingBottom: '4px' }}>
                  {/* Time Capsule */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(139, 92, 246, 0.08)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '100px',
                    padding: '4px 12px',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                  }}
                  >
                    <Clock size={12} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Time:</span>
                    <input
                      type="text"
                      value={form.timeComplexity}
                      onChange={(e) => setForm({ ...form, timeComplexity: e.target.value })}
                      placeholder="e.g. O(n)"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        padding: 0,
                        fontSize: 12,
                        fontWeight: 600,
                        width: '80px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Space Capsule */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '100px',
                    padding: '4px 12px',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-secondary)';
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                  }}
                  >
                    <Layers size={12} style={{ color: 'var(--accent-secondary)' }} />
                    <span style={{ fontSize: 11, color: 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Space:</span>
                    <input
                      type="text"
                      value={form.spaceComplexity}
                      onChange={(e) => setForm({ ...form, spaceComplexity: e.target.value })}
                      placeholder="e.g. O(1)"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        padding: 0,
                        fontSize: 12,
                        fontWeight: 600,
                        width: '80px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Markdown editor area / Google Drive Embedder */}
            <div 
              className="markdown-editor-wrapper"
              style={{
                height: activeTab === 'googleDrive' ? (isMaximized ? '100%' : '420px') : 'auto',
                minHeight: activeTab === 'googleDrive' ? (isMaximized ? 'auto' : '420px') : 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {activeTab === 'googleDrive' ? (
                currentPeerUid ? (
                  !form.googleDriveUrl ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', padding: '40px 20px', flex: 1 }}>
                      <FolderOpen size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '12px', opacity: 0.5 }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>No Drive folder linked</span>
                      <span style={{ fontSize: '11px', marginTop: '4px', textAlign: 'center' }}>This peer hasn't linked a Google Drive folder or document to this note.</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
                      {/* Header toolbar for Google Drive control */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 16px',
                        background: 'var(--bg-tertiary)',
                        borderBottom: '1px solid var(--border-primary)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          {selectedFile ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedFile(null)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                height: '24px',
                                border: '1px solid var(--border-secondary)',
                                background: 'transparent',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              <ChevronLeft size={14} />
                              Back to files
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Peer Linked: {getDriveTypeLabel(form.googleDriveUrl)}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <a
                            href={form.googleDriveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              textDecoration: 'none',
                              padding: '4px 10px',
                              fontSize: '11px',
                              height: '28px',
                            }}
                          >
                            <ExternalLink size={12} />
                            Open
                          </a>
                        </div>
                      </div>

                      {/* Main explorer/iframe */}
                      <div style={{
                        flex: 1,
                        position: 'relative',
                        background: '#14141d',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                      }}>
                        {selectedFile ? (
                          <iframe
                            key={selectedFile.id + iframeKey}
                            src={getEmbeddableDriveUrl(selectedFile.webViewLink)}
                            title="Google Drive Document Embed"
                            width="100%"
                            height="100%"
                            style={{
                              border: 'none',
                              background: '#14141d',
                              flex: 1,
                            }}
                            allow="autoplay"
                          />
                        ) : form.googleDriveUrl.includes('folders') && isAuthorized ? (
                          <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                            {isLoadingFiles ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
                                <RefreshCw size={24} className="spin" style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Loading folder contents...</span>
                              </div>
                            ) : folderFiles.length === 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', padding: '20px' }}>
                                <FolderOpen size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '12px', opacity: 0.5 }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>This folder is empty</span>
                              </div>
                            ) : (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                                gap: '12px',
                              }}>
                                {folderFiles.map((file) => {
                                  let FileIcon = File;
                                  let iconColor = 'var(--text-secondary)';
                                  if (file.mimeType.includes('document')) {
                                    FileIcon = FileText;
                                    iconColor = '#4285F4';
                                  } else if (file.mimeType.includes('spreadsheet')) {
                                    FileIcon = FileSpreadsheet;
                                    iconColor = '#0F9D58';
                                  } else if (file.mimeType.includes('presentation')) {
                                    FileIcon = FileCode;
                                    iconColor = '#F4B400';
                                  } else if (file.mimeType === 'application/pdf') {
                                    FileIcon = FileText;
                                    iconColor = '#DB4437';
                                  } else if (file.mimeType.startsWith('image/')) {
                                    FileIcon = FileImage;
                                    iconColor = '#FF7043';
                                  }
                                  return (
                                    <div
                                      key={file.id}
                                      onClick={() => setSelectedFile(file)}
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        padding: '12px 8px',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'center',
                                        height: '100px',
                                        justifyContent: 'space-between',
                                      }}
                                    >
                                      <FileIcon size={32} style={{ color: iconColor, marginBottom: '6px' }} />
                                      <span
                                        title={file.name}
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 500,
                                          color: 'var(--text-primary)',
                                          width: '100%',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          padding: '0 4px',
                                        }}
                                      >
                                        {file.name}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <iframe
                            key={iframeKey}
                            src={getEmbeddableDriveUrl(form.googleDriveUrl)}
                            title="Google Drive Document Embed"
                            width="100%"
                            height="100%"
                            style={{
                              border: 'none',
                              background: '#14141d',
                              flex: 1,
                            }}
                            allow="autoplay"
                          />
                        )}
                      </div>
                    </div>
                  )
                ) : ( !isAuthorized && !form.googleDriveUrl ? (
                  /* 1. Unauthenticated Setup State */
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    textAlign: 'center',
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.01)',
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '20px',
                      color: 'var(--accent-secondary)',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)'
                    }}>
                      <FolderOpen size={30} />
                    </div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Connect Google Drive
                    </h4>
                    <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: 1.5 }}>
                      Authenticate with your Google account to automatically create structured folders for each topic/problem and upload study materials directly.
                    </p>

                    {gDriveError && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        color: '#EF4444',
                        fontSize: '12px',
                        marginBottom: '16px',
                        maxWidth: '440px',
                      }}>
                        <AlertCircle size={14} style={{ flexShrink: 0 }} />
                        <span>{gDriveError}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleConnectGDrive}
                        disabled={isConnecting}
                        style={{ padding: '0 24px', height: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        {isConnecting ? (
                          <>
                            <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                            Connecting...
                          </>
                        ) : (
                          "Connect Google Drive"
                        )}
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', width: '80%', maxWidth: '360px', margin: '8px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '0 10px' }}>OR LINK MANUALLY</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }} />
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '10px',
                        width: '100%',
                        maxWidth: '440px'
                      }}>
                        <input
                          type="text"
                          placeholder="Paste custom folder/document URL"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-secondary)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleEmbed}
                          style={{ padding: '0 16px', height: '40px' }}
                        >
                          Link
                        </button>
                      </div>
                    </div>
                  </div>
                ) : isAuthorized && !form.googleDriveUrl ? (
                  /* 2. Authenticated But Unlinked State (Auto-creation Pane) */
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    textAlign: 'center',
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.01)',
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '20px',
                      color: 'var(--accent-primary)',
                      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.1)'
                    }}>
                      <UploadCloud size={30} />
                    </div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Setup Google Drive Folder
                    </h4>
                    <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: 1.5 }}>
                      Create a structured folder under <strong>DSA Mastery / {topicName} / {folderName}</strong> in your Google Drive automatically.
                    </p>

                    {gDriveError && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        color: '#EF4444',
                        fontSize: '12px',
                        marginBottom: '16px',
                        maxWidth: '440px',
                      }}>
                        <AlertCircle size={14} style={{ flexShrink: 0 }} />
                        <span>{gDriveError}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAutoCreateFolder}
                        disabled={isCreatingFolder}
                        style={{ padding: '0 24px', height: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        {isCreatingFolder ? (
                          <>
                            <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                            Creating Folders...
                          </>
                        ) : (
                          "Create & Link Google Drive Folder"
                        )}
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', width: '80%', maxWidth: '360px', margin: '8px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '0 10px' }}>OR PASTE CUSTOM LINK</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }} />
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '10px',
                        width: '100%',
                        maxWidth: '440px'
                      }}>
                        <input
                          type="text"
                          placeholder="Paste custom folder/document URL"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-secondary)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleEmbed}
                          style={{ padding: '0 16px', height: '40px' }}
                        >
                          Link
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 3. Linked View State (Iframe + Upload Zone side-by-side or stacked) */
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
                    {/* Header toolbar for Google Drive control */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 16px',
                      background: 'var(--bg-tertiary)',
                      borderBottom: '1px solid var(--border-primary)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        {selectedFile ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedFile(null)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              fontSize: '11px',
                              height: '24px',
                              border: '1px solid var(--border-secondary)',
                              background: 'transparent',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            <ChevronLeft size={14} />
                            Back to files
                          </button>
                        ) : (
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#10B981',
                            boxShadow: '0 0 8px #10B981',
                          }} />
                        )}
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedFile ? `Viewing: ${selectedFile.name}` : `Linked: ${getDriveTypeLabel(form.googleDriveUrl)}`}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {selectedFile ? (
                          <a
                            href={selectedFile.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              textDecoration: 'none',
                              padding: '4px 10px',
                              fontSize: '11px',
                              height: '28px',
                            }}
                          >
                            <ExternalLink size={12} />
                            Open in Drive
                          </a>
                        ) : (
                          <>
                            {form.googleDriveUrl.includes('folders') && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowUploadPanel(true)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  height: '28px',
                                  borderColor: 'rgba(139, 92, 246, 0.4)',
                                  color: 'var(--accent-primary)',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <CloudUpload size={12} />
                                Upload Files
                              </button>
                            )}
                            <a
                              href={form.googleDriveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{
                                display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  textDecoration: 'none',
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  height: '28px',
                              }}
                            >
                              <ExternalLink size={12} />
                              Open
                            </a>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleDisconnect}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            height: '28px',
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                            color: '#EF4444',
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>

                    {gDriveError && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#EF4444',
                        fontSize: '11.5px',
                        padding: '6px 16px',
                        margin: 0,
                      }}>
                        <AlertCircle size={12} style={{ flexShrink: 0 }} />
                        <span>{gDriveError}</span>
                      </div>
                    )}

                    {/* Main content grid (De-cluttered Full Width) */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      minHeight: 0,
                    }}>
                      
                      {/* Full-width Pane (File list OR Iframe preview) */}
                      <div style={{
                        flex: 1,
                        position: 'relative',
                        background: '#14141d',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                      }}>
                        {selectedFile ? (
                          /* Iframe displaying active file preview */
                          <iframe
                            key={selectedFile.id + iframeKey}
                            src={getEmbeddableDriveUrl(selectedFile.webViewLink)}
                            title="Google Drive Document Embed"
                            width="100%"
                            height="100%"
                            style={{
                              border: 'none',
                              background: '#14141d',
                              flex: 1,
                            }}
                            allow="autoplay"
                          />
                        ) : isAuthorized ? (
                          /* Custom Native folder explorer */
                          <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                            {isLoadingFiles ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
                                <RefreshCw size={24} className="spin" style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Loading folder contents...</span>
                              </div>
                            ) : folderFiles.length === 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', padding: '20px' }}>
                                <FolderOpen size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '12px', opacity: 0.5 }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>This folder is empty</span>
                                <span style={{ fontSize: '11px', marginTop: '4px', textAlign: 'center' }}>Click "Upload Files" in the toolbar or footer to start uploading notes!</span>
                              </div>
                            ) : (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                                gap: '12px',
                              }}>
                                {folderFiles.map((file) => {
                                  // Determine type specific color and icon
                                  let FileIcon = File;
                                  let iconColor = 'var(--text-secondary)';
                                  
                                  if (file.mimeType.includes('document')) {
                                    FileIcon = FileText;
                                    iconColor = '#4285F4'; // Docs blue
                                  } else if (file.mimeType.includes('spreadsheet')) {
                                    FileIcon = FileSpreadsheet;
                                    iconColor = '#0F9D58'; // Sheets green
                                  } else if (file.mimeType.includes('presentation')) {
                                    FileIcon = FileCode;
                                    iconColor = '#F4B400'; // Slides yellow
                                  } else if (file.mimeType === 'application/pdf') {
                                    FileIcon = FileText;
                                    iconColor = '#DB4437'; // PDF red
                                  } else if (file.mimeType.startsWith('image/')) {
                                    FileIcon = FileImage;
                                    iconColor = '#FF7043'; // Image orange
                                  }
                                  
                                  return (
                                    <div
                                      key={file.id}
                                      onClick={() => setSelectedFile(file)}
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        padding: '12px 8px',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'center',
                                        height: '100px',
                                        justifyContent: 'space-between',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.background = 'var(--bg-card-hover)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border-primary)';
                                        e.currentTarget.style.transform = 'none';
                                        e.currentTarget.style.background = 'var(--bg-tertiary)';
                                      }}
                                    >
                                      <FileIcon size={32} style={{ color: iconColor, marginBottom: '6px' }} />
                                      <span
                                        title={file.name}
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 500,
                                          color: 'var(--text-primary)',
                                          width: '100%',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          padding: '0 4px',
                                        }}
                                      >
                                        {file.name}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Fallback view (manually linked folder iframe) */
                          <iframe
                            key={iframeKey}
                            src={getEmbeddableDriveUrl(form.googleDriveUrl)}
                            title="Google Drive Document Embed"
                            width="100%"
                            height="100%"
                            style={{
                              border: 'none',
                              background: '#14141d',
                              flex: 1,
                            }}
                            allow="autoplay"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : activeTab === 'collab' ? (
                /* Shared Tab content */
                selectedPeerForView ? (
                  <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Header with Back button and user name */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedPeerForView(null)}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px', padding: '0 12px' }}
                        >
                          <ChevronLeft size={14} /> Back
                        </button>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          @{selectedPeerForView.username}'s Note
                        </h4>
                      </div>

                      {peerForm && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {/* Time Capsule */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'rgba(139, 92, 246, 0.08)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            borderRadius: '100px',
                            padding: '4px 12px',
                          }}>
                            <Clock size={12} style={{ color: 'var(--accent-primary)' }} />
                            <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase' }}>Time:</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {peerForm.timeComplexity || 'N/A'}
                            </span>
                          </div>

                          {/* Space Capsule */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '100px',
                            padding: '4px 12px',
                          }}>
                            <Layers size={12} style={{ color: 'var(--accent-secondary)' }} />
                            <span style={{ fontSize: 11, color: 'var(--accent-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Space:</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {peerForm.spaceComplexity || 'N/A'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {loadingPeerNotesTab ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 0', gap: '10px' }}>
                        <RefreshCw size={24} className="spin" style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Fetching peer's notes...</span>
                      </div>
                    ) : peerForm ? (
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px' }}>
                        {/* Secondary Sub Tabs */}
                        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-secondary)', paddingBottom: '4px' }}>
                          {[
                            { id: 'notes', label: 'Notes', icon: StickyNote },
                            { id: 'details', label: 'Approach & Learnings', icon: Sparkles },
                            { id: 'googleDrive', label: 'Google Drive', icon: FolderOpen }
                          ].map((subTab) => {
                            const Icon = subTab.icon;
                            const isActive = peerActiveSubTab === subTab.id;
                            return (
                              <button
                                key={subTab.id}
                                type="button"
                                onClick={() => setPeerActiveSubTab(subTab.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <Icon size={12} />
                                {subTab.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Sub Tab Contents */}
                        {peerActiveSubTab === 'notes' ? (
                          <div
                            className="markdown-editor-preview"
                            style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(peerForm.notes) || '<p style="color: var(--text-tertiary); font-style: italic;">No notes written...</p>' }}
                          />
                        ) : peerActiveSubTab === 'details' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
                            {!peerForm.keyIdea && !peerForm.optimalApproach && !peerForm.mistakes && !peerForm.interviewLearnings ? (
                              <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>No additional details provided by peer...</p>
                            ) : (
                              <>
                                {peerForm.keyIdea && (
                                  <div>
                                    <h5 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                      <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} /> Key Idea
                                    </h5>
                                    <div className="markdown-editor-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(peerForm.keyIdea) }} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }} />
                                  </div>
                                )}
                                {peerForm.optimalApproach && (
                                  <div>
                                    <h5 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                      <Target size={14} style={{ color: 'var(--accent-primary)' }} /> Optimal Approach
                                    </h5>
                                    <div className="markdown-editor-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(peerForm.optimalApproach) }} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }} />
                                  </div>
                                )}
                                {peerForm.mistakes && (
                                  <div>
                                    <h5 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: '#EF4444' }}>
                                      <AlertTriangle size={14} style={{ color: '#EF4444' }} /> Mistakes to Avoid
                                    </h5>
                                    <div className="markdown-editor-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(peerForm.mistakes) }} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }} />
                                  </div>
                                )}
                                {peerForm.interviewLearnings && (
                                  <div>
                                    <h5 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                      <Info size={14} style={{ color: 'var(--text-secondary)' }} /> Interview Learnings
                                    </h5>
                                    <div className="markdown-editor-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(peerForm.interviewLearnings) }} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }} />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          /* Google Drive Sub Tab */
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
                            {!peerForm.googleDriveUrl ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', padding: '40px 20px', flex: 1 }}>
                                <FolderOpen size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '12px', opacity: 0.5 }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>No Drive folder linked</span>
                                <span style={{ fontSize: '11px', marginTop: '4px', textAlign: 'center' }}>This peer hasn't linked a Google Drive folder or document to this note.</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '300px' }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  background: 'var(--bg-tertiary)',
                                  border: '1px solid var(--border-primary)',
                                  borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                                  borderBottom: 'none',
                                }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Peer Linked: {getDriveTypeLabel(peerForm.googleDriveUrl)}
                                  </span>
                                  <a
                                    href={peerForm.googleDriveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      textDecoration: 'none',
                                      padding: '4px 10px',
                                      fontSize: '11px',
                                      height: '28px',
                                    }}
                                  >
                                    <ExternalLink size={12} />
                                    Open
                                  </a>
                                </div>
                                <div style={{
                                  flex: 1,
                                  background: '#14141d',
                                  border: '1px solid var(--border-primary)',
                                  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  minHeight: '280px',
                                  position: 'relative',
                                  overflow: 'hidden'
                                }}>
                                  {peerSelectedFile ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', position: 'relative' }}>
                                      <button
                                        type="button"
                                        onClick={() => setPeerSelectedFile(null)}
                                        className="btn btn-secondary btn-sm"
                                        style={{
                                          position: 'absolute',
                                          top: '8px',
                                          left: '8px',
                                          zIndex: 10,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          height: '24px',
                                          padding: '0 8px',
                                          fontSize: '10px',
                                        }}
                                      >
                                        <ChevronLeft size={10} /> Back to Folder
                                      </button>
                                      <iframe
                                        src={getEmbeddableDriveUrl(peerSelectedFile.webViewLink)}
                                        title="Google Drive Document Embed"
                                        width="100%"
                                        height="100%"
                                        style={{
                                          border: 'none',
                                          background: '#14141d',
                                          flex: 1,
                                          paddingTop: '40px',
                                        }}
                                        allow="autoplay"
                                      />
                                    </div>
                                  ) : peerForm.googleDriveUrl.includes('folders') && isAuthorized ? (
                                    /* Custom Native folder explorer for peer */
                                    <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                                      {isLoadingPeerFiles ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', padding: '40px 0' }}>
                                          <RefreshCw size={24} className="spin" style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Loading folder contents...</span>
                                        </div>
                                      ) : peerFolderFiles.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', padding: '40px 20px' }}>
                                          <FolderOpen size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '12px', opacity: 0.5 }} />
                                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>This folder is empty</span>
                                        </div>
                                      ) : (
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                                          gap: '12px',
                                        }}>
                                          {peerFolderFiles.map((file) => {
                                            let FileIcon = File;
                                            let iconColor = 'var(--text-secondary)';
                                            
                                            if (file.mimeType.includes('document')) {
                                              FileIcon = FileText;
                                              iconColor = '#4285F4';
                                            } else if (file.mimeType.includes('spreadsheet')) {
                                              FileIcon = FileSpreadsheet;
                                              iconColor = '#0F9D58';
                                            } else if (file.mimeType.includes('presentation')) {
                                              FileIcon = FileCode;
                                              iconColor = '#F4B400';
                                            } else if (file.mimeType === 'application/pdf') {
                                              FileIcon = FileText;
                                              iconColor = '#DB4437';
                                            } else if (file.mimeType.startsWith('image/')) {
                                              FileIcon = FileImage;
                                              iconColor = '#FF7043';
                                            }
                                            
                                            return (
                                              <div
                                                key={file.id}
                                                onClick={() => setPeerSelectedFile(file)}
                                                style={{
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  alignItems: 'center',
                                                  padding: '12px 8px',
                                                  background: 'var(--bg-tertiary)',
                                                  border: '1px solid var(--border-primary)',
                                                  borderRadius: 'var(--radius-md)',
                                                  cursor: 'pointer',
                                                  transition: 'all 0.2s',
                                                  textAlign: 'center',
                                                  height: '100px',
                                                  justifyContent: 'space-between',
                                                }}
                                                onMouseEnter={(e) => {
                                                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                                                }}
                                                onMouseLeave={(e) => {
                                                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                                                  e.currentTarget.style.transform = 'none';
                                                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                                                }}
                                              >
                                                <FileIcon size={32} style={{ color: iconColor, marginBottom: '6px' }} />
                                                <span
                                                  title={file.name}
                                                  style={{
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                    color: 'var(--text-primary)',
                                                    width: '100%',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    padding: '0 4px',
                                                  }}
                                                >
                                                  {file.name}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    /* Fallback direct iframe preview */
                                    <iframe
                                      src={getEmbeddableDriveUrl(peerForm.googleDriveUrl)}
                                      title="Google Drive Document Embed"
                                      width="100%"
                                      height="100%"
                                      style={{
                                        border: 'none',
                                        background: '#14141d',
                                        flex: 1,
                                      }}
                                      allow="autoplay"
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>Failed to load peer's notes.</p>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Sharing Form */}
                    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                        <UserPlus size={16} style={{ color: 'var(--accent-primary)' }} /> Share Note with Peer
                      </h4>
                      <form onSubmit={handleShare} style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="text"
                          placeholder="Enter recipient username"
                          value={shareUsername}
                          onChange={(e) => setShareUsername(e.target.value)}
                          disabled={isSharing}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-secondary)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={isSharing || !shareUsername.trim()}
                          style={{ height: '36px', padding: '0 16px' }}
                        >
                          {isSharing ? 'Sharing...' : 'Share'}
                        </button>
                      </form>
                      {shareError && <div style={{ color: '#EF4444', fontSize: '12px', marginTop: '8px' }}>{shareError}</div>}
                      {shareSuccess && <div style={{ color: '#10B981', fontSize: '12px', marginTop: '8px' }}>{shareSuccess}</div>}
                    </div>

                    {/* Active Outbound Shares */}
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Active Shares
                      </h4>
                      {outboundShares.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                          You haven't shared this note with anyone yet.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {outboundShares.map((s) => (
                            <div
                              key={s.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 'var(--radius-md)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  @{s.recipientUsername}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: s.status === 'accepted' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                    color: s.status === 'accepted' ? '#10B981' : '#F59E0B',
                                  }}
                                >
                                  {s.status}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRevokeShare(s.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '4px'
                                }}
                                title="Revoke access"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Peer Shared Notes List */}
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Peers who shared notes for this topic
                      </h4>
                      {peerShares.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                          No peers have shared their notes for this topic with you.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {peerShares.map((ps) => (
                            <button
                              key={ps.ownerUid}
                              type="button"
                              onClick={() => {
                                setSelectedPeerForView({ uid: ps.ownerUid, username: ps.ownerUsername });
                                setPeerActiveSubTab('notes');
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: 'rgba(139, 92, 246, 0.08)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                borderRadius: '20px',
                                color: 'var(--accent-primary)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <Users size={12} />
                              View @{ps.ownerUsername}'s Note
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <>
                  <div className="markdown-toolbar" style={{ justifyContent: currentPeerUid ? 'flex-end' : 'space-between' }}>
                    {!currentPeerUid && (
                      <div className="markdown-toolbar-group">
                        <button
                          type="button"
                          className="markdown-toolbar-btn"
                          onClick={() => insertMarkdown('heading')}
                          title="Heading"
                        >
                          <Heading size={14} />
                        </button>
                        <button
                          type="button"
                          className="markdown-toolbar-btn"
                          onClick={() => insertMarkdown('bold')}
                          title="Bold"
                        >
                          <Bold size={14} />
                        </button>
                        <button
                          type="button"
                          className="markdown-toolbar-btn"
                          onClick={() => insertMarkdown('italic')}
                          title="Italic"
                        >
                          <Italic size={14} />
                        </button>
                        <div style={{ width: 1, height: 16, background: 'var(--border-primary)', margin: '0 4px' }} />
                        <button
                          type="button"
                          className="markdown-toolbar-btn"
                          onClick={() => insertMarkdown('ul')}
                          title="Unordered List"
                        >
                          <List size={14} />
                        </button>
                        <button
                          type="button"
                          className="markdown-toolbar-btn"
                          onClick={() => insertMarkdown('ol')}
                          title="Ordered List"
                        >
                          <ListOrdered size={14} />
                        </button>
                        <button
                          type="button"
                          className="markdown-toolbar-btn"
                          onClick={() => insertMarkdown('quote')}
                          title="Blockquote"
                        >
                          <Quote size={14} />
                        </button>
                        <button
                          type="button"
                          className="markdown-toolbar-btn"
                          onClick={() => insertMarkdown('code')}
                          title="Code Block"
                        >
                          <Code size={14} />
                        </button>
                        <div style={{ width: 1, height: 16, background: 'var(--border-primary)', margin: '0 4px' }} />
                        <button
                          type="button"
                          className="markdown-toolbar-btn"
                          onClick={() => insertMarkdown('link')}
                          title="Link"
                        >
                          <Link size={14} />
                        </button>
                        <button
                          type="button"
                          className="markdown-toolbar-btn"
                          onClick={() => insertMarkdown('image')}
                          title="Image"
                        >
                          <Image size={14} />
                        </button>
                      </div>
                    )}
                    <div className="markdown-toolbar-group">
                      {!currentPeerUid && (
                        <button
                          type="button"
                          className={`markdown-toolbar-btn ${isPreview ? 'active' : ''}`}
                          onClick={() => setIsPreview(!isPreview)}
                          title={isPreview ? "Show Editor" : "Show Preview"}
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className={`markdown-toolbar-btn ${isMaximized ? 'active' : ''}`}
                        onClick={() => setIsMaximized(!isMaximized)}
                        title={isMaximized ? "Minimize" : "Maximize"}
                      >
                        {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </button>
                    </div>
                  </div>

                  {isPreview ? (
                    <div
                      className="markdown-editor-preview"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(form[activeTab]) || '<p style="color: var(--text-tertiary); font-style: italic;">Nothing to preview yet...</p>' }}
                    />
                  ) : (
                    <textarea
                      ref={textareaRef}
                      value={form[activeTab]}
                      onChange={(e) => setForm({ ...form, [activeTab]: e.target.value })}
                      placeholder={`Type here...(Markdown is enabled for ${activeTab})`}
                      className="markdown-editor-textarea"
                      rows={10}
                      readOnly={!!currentPeerUid}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

        <div className="modal-footer" style={{ gap: '10px' }}>
          {currentPeerUid ? (
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          ) : (
            <>
              {activeTab === 'googleDrive' && isAuthorized && form.googleDriveUrl && form.googleDriveUrl.includes('folders') && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowUploadPanel(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0 16px',
                    height: '38px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    color: 'var(--accent-primary)',
                    background: 'rgba(139, 92, 246, 0.03)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                  }}
                >
                  <CloudUpload size={16} />
                  Upload Files
                </button>
              )}
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Notes</button>
            </>
          )}
        </div>

        {/* Upload Overlay */}
        {showUploadPanel && (
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(10, 10, 15, 0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px',
              borderRadius: 'var(--radius-xl)', // matches modal xl border radius
              animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={() => setShowUploadPanel(false)}
          >
            <div 
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '12px',
                padding: '24px',
                width: '100%',
                maxWidth: '480px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                gap: '16px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button top right */}
              <button
                type="button"
                onClick={() => setShowUploadPanel(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={18} />
              </button>

              {/* Title & Description */}
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CloudUpload size={20} style={{ color: 'var(--accent-primary)' }} />
                  Upload to Google Drive
                </h3>
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Files will be uploaded directly to the linked folder: <br/>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                    {form.googleDriveUrl.split('/').pop()}
                  </span>
                </p>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('overlay-gdrive-file-input').click()}
                style={{
                  border: dragActive ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-secondary)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '32px 16px',
                  background: dragActive ? 'rgba(139, 92, 246, 0.06)' : 'rgba(255, 255, 255, 0.01)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!dragActive) e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
                }}
                onMouseLeave={(e) => {
                  if (!dragActive) e.currentTarget.style.borderColor = 'var(--border-secondary)';
                }}
              >
                <CloudUpload size={36} style={{ color: dragActive ? 'var(--accent-primary)' : 'var(--text-secondary)', marginBottom: '12px' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Drag & Drop files here
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  or click to select files from your computer
                </span>
                <input
                  type="file"
                  id="overlay-gdrive-file-input"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
              </div>

              {/* Active uploads queue */}
              {Object.keys(uploadingFiles).length > 0 && (
                <div style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  maxHeight: '130px',
                  overflowY: 'auto',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Upload Queue ({Object.keys(uploadingFiles).length})
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(uploadingFiles).map(([filename, status]) => (
                      <div key={filename} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', gap: '8px' }}>
                        <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {filename}
                        </span>
                        <span style={{
                          flexShrink: 0,
                          fontSize: '10px',
                          fontWeight: 700,
                          color: status === 'success' ? '#10B981' : status === 'error' ? '#EF4444' : 'var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {status === 'success' && <CheckCircle size={12} />}
                          {status === 'error' && <AlertCircle size={12} />}
                          {status === 'uploading' && <RefreshCw size={12} className="spin" style={{ animation: 'spin 1s linear infinite' }} />}
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Done / Close Button */}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowUploadPanel(false)}
                style={{
                  width: '100%',
                  height: '40px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
