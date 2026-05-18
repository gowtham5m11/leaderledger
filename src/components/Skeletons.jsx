import React from 'react';
import Footer from './Footer';

export const DistrictSkeleton = () => (
  <div className="district-layout animate-pulse">
    <div className="map-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="skeleton-box" style={{ width: '80%', height: '80%', borderRadius: '2rem' }}></div>
    </div>
    <div className="details-panel-container mobile-visible" style={{ width: '440px', transform: 'translateX(0)' }}>
      <aside className="floating-panel">
        <div className="skeleton-box" style={{ width: '60%', height: '2rem', marginBottom: '1rem' }}></div>
        <div className="skeleton-box" style={{ width: '80%', height: '1rem', marginBottom: '2rem' }}></div>
        
        <div className="p-8 rounded-[2rem] bg-surface-container-low mb-8 flex items-center gap-6">
          <div className="skeleton-box" style={{ width: '6rem', height: '6rem', borderRadius: '1.5rem', flexShrink: 0 }}></div>
          <div style={{ flex: 1 }}>
            <div className="skeleton-box" style={{ width: '40%', height: '1.5rem', marginBottom: '1rem', borderRadius: '999px' }}></div>
            <div className="skeleton-box" style={{ width: '90%', height: '2rem' }}></div>
          </div>
        </div>

        <div className="flex flex-col gap-6 mb-8">
          <div className="p-6 rounded-3xl bg-surface-container-low">
            <div className="skeleton-box" style={{ width: '40%', height: '1rem', marginBottom: '1rem' }}></div>
            <div className="skeleton-box" style={{ width: '60%', height: '2rem' }}></div>
          </div>
          <div className="p-6 rounded-3xl bg-surface-container-low">
            <div className="skeleton-box" style={{ width: '40%', height: '1rem', marginBottom: '1rem' }}></div>
            <div className="skeleton-box" style={{ width: '60%', height: '2rem' }}></div>
          </div>
        </div>
      </aside>
    </div>
  </div>
);

export const ListSkeleton = () => (
  <div className="bg-surface text-on-surface" style={{ fontFamily: "'Outfit', sans-serif" }}>
    <main className="page-main animate-pulse">
      <div className="list-title-block" style={{ marginBottom: '3rem' }}>
        <div className="skeleton-box" style={{ width: '40%', height: '3rem', marginBottom: '1rem' }}></div>
        <div className="skeleton-box" style={{ width: '60%', height: '1.5rem', marginBottom: '0.5rem' }}></div>
        <div className="skeleton-box" style={{ width: '50%', height: '1.5rem' }}></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="bg-surface-container-low" style={{ padding: '1rem 1.5rem', borderRadius: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div className="skeleton-box" style={{ width: '5rem', height: '1rem', marginBottom: '0.5rem' }}></div>
            <div className="skeleton-box" style={{ width: '12rem', height: '2rem' }}></div>
          </div>
          <div className="skeleton-box" style={{ width: '8rem', height: '1.5rem' }}></div>
        </div>
        
        <div className="bg-surface-container-low" style={{ padding: '1.25rem 1.5rem', borderRadius: '1.5rem', height: '12rem' }}>
          <div className="skeleton-box" style={{ width: '100%', height: '100%', borderRadius: '0.5rem' }}></div>
        </div>
      </div>

      <div className="leader-grid">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="leader-card" style={{ height: '300px' }}>
            <div className="skeleton-box" style={{ width: '100%', height: '120px', borderRadius: '1rem', marginBottom: '1rem' }}></div>
            <div className="skeleton-box" style={{ width: '70%', height: '1.5rem', marginBottom: '0.5rem' }}></div>
            <div className="skeleton-box" style={{ width: '40%', height: '1rem', marginBottom: '1rem' }}></div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className="skeleton-box" style={{ width: '4rem', height: '1.5rem', borderRadius: '999px' }}></div>
              <div className="skeleton-box" style={{ width: '4rem', height: '1.5rem', borderRadius: '999px' }}></div>
            </div>
          </div>
        ))}
      </div>
    </main>
    <Footer />
  </div>
);

export const ProfileSkeleton = () => (
  <div style={{ backgroundColor: 'var(--surface)', color: 'var(--on-surface)', fontFamily: "'Outfit', sans-serif" }}>
    <main className="page-main animate-pulse">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between' }}>
        <div className="skeleton-box" style={{ width: '10rem', height: '2rem', borderRadius: '999px' }}></div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <div className="skeleton-box" style={{ width: '3rem', height: '2rem', borderRadius: '999px' }}></div>
          <div className="skeleton-box" style={{ width: '8rem', height: '2rem', borderRadius: '999px' }}></div>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--surface-container-lowest)', borderRadius: '1.5rem', border: '1px solid var(--outline-variant)' }}>
        <div className="profile-hero">
          <div style={{ flexShrink: 0 }}>
            <div className="skeleton-box" style={{ width: '100%', height: '100%', borderRadius: '1.5rem', minWidth: '150px', minHeight: '150px' }}></div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="skeleton-box" style={{ width: '8rem', height: '1.5rem', borderRadius: '999px' }}></div>
            <div className="skeleton-box" style={{ width: '60%', height: '3rem' }}></div>
            <div className="skeleton-box" style={{ width: '40%', height: '1.5rem' }}></div>
            
            <div className="profile-info-grid" style={{ marginTop: '2rem' }}>
              <div className="skeleton-box" style={{ width: '100%', height: '3rem' }}></div>
              <div className="skeleton-box" style={{ width: '100%', height: '3rem' }}></div>
              <div className="skeleton-box" style={{ width: '100%', height: '3rem', gridColumn: 'span 3' }}></div>
              <div className="skeleton-box" style={{ width: '100%', height: '3rem', gridColumn: 'span 3' }}></div>
            </div>
          </div>
        </div>

        <div className="profile-content-split" style={{ padding: '3rem' }}>
          <div className="profile-timeline" style={{ flex: 2 }}>
            <div className="skeleton-box" style={{ width: '40%', height: '2rem', marginBottom: '3rem' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <div className="skeleton-box" style={{ width: '4rem', height: '1.5rem', marginBottom: '0.5rem' }}></div>
                  <div className="skeleton-box" style={{ width: '60%', height: '1.5rem', marginBottom: '0.5rem' }}></div>
                  <div className="skeleton-box" style={{ width: '90%', height: '3rem' }}></div>
                </div>
              ))}
            </div>
          </div>
          <div className="profile-side" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="skeleton-box" style={{ width: '100%', height: '12rem', borderRadius: '1rem' }}></div>
            <div className="skeleton-box" style={{ width: '100%', height: '16rem', borderRadius: '1rem' }}></div>
          </div>
        </div>
      </div>
    </main>
    <div style={{ height: '8rem' }}></div>
  </div>
);

export const GenericPageSkeleton = () => (
  <div style={{ backgroundColor: 'var(--surface)', color: 'var(--on-surface)', fontFamily: "'Outfit', sans-serif", minHeight: '100vh' }}>
    <main className="page-main animate-pulse" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '4rem' }}>
      <div className="skeleton-box" style={{ width: '60%', height: '3rem', marginBottom: '2rem' }}></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="skeleton-box" style={{ width: '100%', height: '1.5rem' }}></div>
        <div className="skeleton-box" style={{ width: '95%', height: '1.5rem' }}></div>
        <div className="skeleton-box" style={{ width: '90%', height: '1.5rem' }}></div>
        <div className="skeleton-box" style={{ width: '98%', height: '1.5rem' }}></div>
        <div className="skeleton-box" style={{ width: '85%', height: '1.5rem', marginBottom: '2rem' }}></div>
        
        <div className="skeleton-box" style={{ width: '40%', height: '2rem', marginBottom: '1rem' }}></div>
        <div className="skeleton-box" style={{ width: '100%', height: '1.5rem' }}></div>
        <div className="skeleton-box" style={{ width: '92%', height: '1.5rem' }}></div>
        <div className="skeleton-box" style={{ width: '88%', height: '1.5rem' }}></div>
      </div>
    </main>
  </div>
);
