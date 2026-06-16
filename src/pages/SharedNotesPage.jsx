import { useEffect, useState } from 'react';
import { auth, db } from '../firebaseClient.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Users, Check, X, FileText, AlertCircle, Calendar, Share2 } from 'lucide-react';
import NotesModal from '../components/modals/NotesModal.jsx';

export default function SharedNotesPage() {
  const [user, setUser] = useState(auth.currentUser);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  const fetchShares = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'shared_notes_access'),
        where('recipientUid', '==', user.uid)
      );
      const snap = await getDocs(q);
      const items = [];
      snap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      setShares(items);
    } catch (err) {
      console.error("Failed to fetch shared notes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchShares();
    }
  }, [user]);

  const handleAccept = async (share) => {
    try {
      const docRef = doc(db, 'shared_notes_access', share.id);
      await updateDoc(docRef, { status: 'accepted' });
      // Refresh local list
      setShares((prev) =>
        prev.map((s) => (s.id === share.id ? { ...s, status: 'accepted' } : s))
      );
    } catch (err) {
      console.error("Failed to accept share:", err);
    }
  };

  const handleDecline = async (share) => {
    try {
      const docRef = doc(db, 'shared_notes_access', share.id);
      await deleteDoc(docRef);
      // Remove from local list
      setShares((prev) => prev.filter((s) => s.id !== share.id));
    } catch (err) {
      console.error("Failed to decline share:", err);
    }
  };

  const pendingShares = shares.filter((s) => s.status === 'pending');
  const acceptedShares = shares.filter((s) => s.status === 'accepted');

  return (
    <div className="page-content animate-fade-in" style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: 'var(--space-7)' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={24} style={{ color: 'var(--accent-primary)' }} /> Shared Notes & Collaboration
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Access question and concept notes shared by your study group, and accept incoming share requests.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Pending Share Requests */}
        {pendingShares.length > 0 && (
          <div className="card" style={{ border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(139, 92, 246, 0.02)', padding: '20px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Share2 size={16} /> Pending Share Invitations ({pendingShares.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingShares.map((share) => (
                <div
                  key={share.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {share.ownerUsername}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: '4px' }}>
                      shared notes for
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', marginLeft: '4px' }}>
                      {share.isConcept ? `Concept: ${share.title}` : `Question: ${share.questionNum}. ${share.title}`}
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Calendar size={12} />
                      <span>{new Date(share.sharedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDecline(share)}
                      style={{ height: '32px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    >
                      <X size={14} /> Decline
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAccept(share)}
                      style={{ height: '32px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Check size={14} /> Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accepted Shared Notes */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} style={{ color: 'var(--accent-primary)' }} /> Accepted Peer Notes ({acceptedShares.length})
          </h3>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              Loading shared notes...
            </div>
          ) : acceptedShares.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
              <AlertCircle size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>No shared notes yet</span>
              <span style={{ fontSize: '11px', marginTop: '4px', textAlign: 'center', maxWidth: '360px' }}>
                When your study group shares conceptual or problem notes with you, and you accept them, they will appear here!
              </span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              {acceptedShares.map((share) => (
                <div
                  key={share.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-secondary)',
                    borderRadius: 'var(--radius-md)',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-primary)', marginBottom: '8px' }}>
                      {share.isConcept ? 'Concept Note' : 'Question Note'}
                    </span>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {share.isConcept ? share.title : `${share.questionNum}. ${share.title}`}
                    </h4>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Shared by <strong style={{ color: 'var(--text-primary)' }}>{share.ownerUsername}</strong> ({share.topicName || 'General'})
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (share.isConcept) {
                        setActiveNote({
                          isConcept: true,
                          concept: {
                            patternId: share.noteId.replace('concept_', ''),
                            patternName: share.title,
                            topicName: share.topicName || 'General',
                          },
                          ownerUid: share.ownerUid,
                          ownerUsername: share.ownerUsername
                        });
                      } else {
                        setActiveNote({
                          isConcept: false,
                          question: {
                            id: parseInt(share.noteId),
                            num: share.questionNum,
                            title: share.title,
                            topic: share.topicName,
                          },
                          ownerUid: share.ownerUid,
                          ownerUsername: share.ownerUsername
                        });
                      }
                    }}
                    style={{ height: '36px', padding: '0 16px', fontSize: '13px' }}
                  >
                    View Notes
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeNote && (
        <NotesModal
          isConcept={activeNote.isConcept}
          concept={activeNote.concept}
          question={activeNote.question}
          peerOwnerUid={activeNote.ownerUid}
          peerOwnerUsername={activeNote.ownerUsername}
          onClose={() => setActiveNote(null)}
        />
      )}
    </div>
  );
}
