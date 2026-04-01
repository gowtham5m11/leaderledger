import React from 'react';
import { 
  X, MapPin, Calendar, BookOpen, 
  Briefcase, AlertCircle, ExternalLink,
  ChevronRight, Award, Shield
} from 'lucide-react';
import { partyColors } from '../data/mockData';

const CandidateProfile = ({ candidate, onClose }) => {
  if (!candidate) return null;

  const partyColor = partyColors[candidate.party] || '#ccc';

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-on-surface/40 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-5xl h-[90vh] bg-surface-container-lowest rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in slide-in-from-bottom-8 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Column - Visuals & Fixed Info */}
        <div className="w-full md:w-[40%] bg-surface-container-low relative flex flex-col sm:flex-row md:flex-col shrink-0">
          <div className="relative w-full aspect-square sm:aspect-auto sm:h-full md:h-auto md:aspect-square overflow-hidden">
            <img 
              src={candidate.image} 
              alt={candidate.name}
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
            
            <button 
              onClick={onClose}
              className="absolute top-6 left-6 p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-all active:scale-90 md:hidden"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 md:p-8 flex flex-col gap-4">
            <div>
              <span 
                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: partyColor }}
              >
                {candidate.party}
              </span>
              <h2 className="text-3xl md:text-4xl font-headline mt-3 text-on-surface leading-tight">
                {candidate.name}
              </h2>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center gap-3 text-on-surface-variant bg-surface-container-high/50 p-3 rounded-2xl border border-outline-variant/30">
                <div className="p-2 bg-white rounded-xl text-primary shadow-sm">
                  <Award size={18} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold opacity-60">Designation</p>
                  <p className="font-semibold text-sm">{candidate.role}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Scrollable Details */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="hidden md:flex items-center justify-between p-8 pb-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-outline">
              Candidate Dossier <ChevronRight size={12} /> <span className="text-primary">{candidate.name.split(' ')[0]}</span>
            </div>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-surface-container-high rounded-full transition-all text-outline hover:text-on-surface active:scale-95"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
              <DetailBox icon={<Calendar />} label="Age" value={candidate.age || candidate.dob} />
              <DetailBox icon={<MapPin />} label="Constituency" value={candidate.locations[0].place} />
              <DetailBox icon={<BookOpen />} label="Education" value={candidate.education} />
              <DetailBox icon={<Briefcase />} label="Experience" value={candidate.experience} />
            </div>

            <section className="mb-12">
              <h3 className="text-lg font-headline mb-6 flex items-center gap-3">
                <Shield className="text-primary" size={20} />
                Integrity Report
              </h3>
              <div className={`p-6 rounded-3xl border ${candidate.criminalRecord?.includes('None') ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl ${candidate.criminalRecord?.includes('None') ? 'bg-white text-green-600' : 'bg-white text-red-600'} shadow-sm`}>
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <p className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${candidate.criminalRecord?.includes('None') ? 'text-green-800' : 'text-red-800'}`}>
                      Legal Disclosure
                    </p>
                    <p className={`text-sm leading-relaxed ${candidate.criminalRecord?.includes('None') ? 'text-green-900' : 'text-red-900'}`}>
                      {candidate.criminalRecord}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-4">
              <h3 className="text-lg font-headline mb-6">Career Timeline</h3>
              <div className="space-y-4">
                {candidate.locations.map((loc, idx) => (
                  <div key={idx} className="flex items-center gap-4 group">
                    <div className="w-20 shrink-0 text-[10px] font-bold text-outline group-hover:text-primary transition-colors">{loc.year}</div>
                    <div className="h-px flex-1 bg-outline-variant" />
                    <div className="bg-surface-container-low px-4 py-2 rounded-xl text-sm font-medium border border-outline-variant/30">{loc.place}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="p-8 bg-surface-container-lowest border-t border-outline-variant/30 flex justify-end gap-4">
            <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
              ECI Affidavit <ExternalLink size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailBox = ({ icon, label, value }) => (
  <div className="flex items-start gap-4 p-5 rounded-3xl border border-outline-variant/50 hover:border-primary/30 transition-colors">
    <div className="p-3 bg-surface-container-low text-primary rounded-2xl">
      {React.cloneElement(icon, { size: 20 })}
    </div>
    <div>
      <p className="text-[10px] uppercase font-bold tracking-wider text-outline mb-1">{label}</p>
      <p className="text-sm font-semibold text-on-surface">{value}</p>
    </div>
  </div>
);

export default CandidateProfile;
