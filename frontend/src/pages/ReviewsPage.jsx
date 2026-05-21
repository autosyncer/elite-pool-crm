import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import SearchBar from '../components/common/SearchBar';

const ReviewsPage = () => {
  const { reviews, refreshReviews, checkAccess, toast } = useAppContext();

  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [addModal, setAddModal] = useState({ open: false, clients: [], loading: false });
  const [reviewModal, setReviewModal] = useState({ open: false, client: null, rating: 0, note: '' });

  if (!checkAccess('feedback')) return <Navigate to="/dashboard" />;

  const fetchEligibleClients = async () => {
    setAddModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await axios.get('/review/eligible-clients');
      setAddModal(prev => ({ ...prev, clients: res.data, loading: false }));
    } catch (error) {
      console.error("Error fetching eligible clients:", error);
      toast('❌ Failed to load eligible clients', 'error');
      setAddModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSaveReview = async (leadCode, leadType, rating, note) => {
    if (rating === 0) {
      toast('⚠️ Please select a rating', 'warn');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('lead_type', leadType);
      formData.append('lead_code', leadCode);
      formData.append('rating', rating);
      formData.append('feedback_note', note);

      await axios.post('/review/client-review', formData);
      toast('⭐ Review saved successfully', 'success');
      setReviewModal({ open: false, client: null, rating: 0, note: '' });
      refreshReviews();
    } catch (error) {
      console.error("Error saving review:", error);
      toast('❌ Failed to save review', 'error');
    }
  };

  const filtered = reviews.filter(r => {
    const q = search.toLowerCase();
    const matchesSearch = r.name.toLowerCase().includes(q) || r.phone.includes(q) || r.lead_code.toLowerCase().includes(q);
    const matchesRating = ratingFilter === 'all' ? true : 
                         ratingFilter === 'high' ? r.rating >= 4 :
                         ratingFilter === 'low' ? r.rating <= 2 :
                         r.rating === parseInt(ratingFilter);
    return matchesSearch && matchesRating;
  });

  return (
    <div className="page" id="page_reviews">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Reviews & Feedback</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Monitor client satisfaction and service quality ratings</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-sky" onClick={() => { setAddModal(prev => ({ ...prev, open: true })); fetchEligibleClients(); }}>
            + Add Review
          </button>
        </div>
      </div>

      <div className="table-toolbar" style={{ borderRadius: '12px 12px 0 0' }}>
        <div className="table-toolbar-left" style={{ display: 'flex', gap: '16px' }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name, phone or code..." />
          <select 
            className="fs" 
            style={{ width: '160px' }} 
            value={ratingFilter} 
            onChange={e => setRatingFilter(e.target.value)}
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="high">4+ Stars</option>
            <option value="low">2- Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: 'none', borderRadius: '0 0 12px 12px' }}>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Category</th>
                <th>Rating</th>
                <th>Feedback</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{r.name}</div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--text3)' }}>{r.phone}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--sky)', textTransform: 'uppercase' }}>{r.lead_type}</div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--text3)' }}>{r.lead_code}</div>
                  </td>
                  <td>
                    <div style={{ color: 'var(--gold)', fontSize: '14px' }}>
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '13px', color: 'var(--text2)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.feedback_note || <span style={{ fontStyle: 'italic', color: 'var(--text3)' }}>No feedback notes</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => setReviewModal({ open: true, client: r, rating: r.rating, note: r.feedback_note || '' })}
                    >
                      Update
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center' }}>
                    <EmptyState title="No reviews matching your criteria" icon="⭐" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Review Client Selection Modal */}
      <Modal 
        open={addModal.open} 
        onClose={() => setAddModal({ open: false, clients: [], loading: false })}
        title="Select Client for Review"
      >
        <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px' }}>
          Only clients with at least one logged interaction in the Follow-up section are eligible for review.
        </p>
        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {addModal.loading ? (
            <p style={{ textAlign: 'center', padding: '20px' }}>Loading eligible clients...</p>
          ) : addModal.clients.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)' }}>No eligible clients found for review.</p>
          ) : addModal.clients.map(c => (
            <div 
              key={c.lead_code} 
              className="card" 
              style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid var(--bg3)' }}
              onClick={() => {
                setReviewModal({ open: true, client: c, rating: 0, note: '' });
                setAddModal({ open: false, clients: [], loading: false });
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{c.name}</div>
                <div className="mono" style={{ fontSize: '11px', color: 'var(--text3)' }}>{c.lead_code} • {c.lead_type.toUpperCase()}</div>
              </div>
              <button className="btn btn-sky btn-sm">Select</button>
            </div>
          ))}
        </div>
      </Modal>

      {/* Write Review Modal */}
      <Modal 
        open={reviewModal.open} 
        onClose={() => setReviewModal({ open: false, client: null, rating: 0, note: '' })}
        title={reviewModal.client ? `Review for ${reviewModal.client.name}` : "Submit Review"}
      >
        {reviewModal.client && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label className="fl">Rating</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {[1,2,3,4,5].map(n => (
                  <span 
                    key={n} 
                    style={{ fontSize: '32px', cursor: 'pointer', color: n <= reviewModal.rating ? 'var(--gold)' : 'var(--bg3)', transition: '0.2s' }}
                    onClick={() => setReviewModal(prev => ({ ...prev, rating: n }))}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            <div className="fg">
              <label className="fl">Feedback Note</label>
              <textarea 
                className="ft" 
                style={{ minHeight: '120px' }}
                placeholder="What did the client say? Capture their sentiment here..."
                value={reviewModal.note}
                onChange={e => setReviewModal(prev => ({ ...prev, note: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setReviewModal({ open: false, client: null, rating: 0, note: '' })}>Cancel</button>
              <button 
                className="btn btn-sky" 
                onClick={() => handleSaveReview(reviewModal.client.lead_code, reviewModal.client.lead_type, reviewModal.rating, reviewModal.note)}
              >
                Save Review
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReviewsPage;
