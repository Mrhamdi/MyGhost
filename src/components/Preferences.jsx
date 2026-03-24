import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { X } from 'lucide-react';

const Preferences = ({ preferences, setPreferences, isOpen, onClose }) => {
    const [countriesList, setCountriesList] = useState([]);

    useEffect(() => {
        fetch('https://restcountries.com/v3.1/all?fields=name,flag,cca2')
            .then(res => res.json())
            .then(data => {
                const filtered = data.filter(c => c.name.common !== 'Israel');
                const sorted = filtered.sort((a, b) => a.name.common.localeCompare(b.name.common));
                setCountriesList(sorted);
            })
            .catch(err => console.error("Error fetching countries:", err));
    }, []);

    const customStyles = {
        control: (provided) => ({
            ...provided,
            background: 'var(--bg-color)',
            borderColor: 'var(--card-border)',
            borderWidth: '1px',
            color: 'var(--text-primary)',
            borderRadius: '12px',
            padding: '2px 4px',
            boxShadow: 'none',
            '&:hover': { borderColor: 'var(--accent-color)' }
        }),
        menu: (provided) => ({
            ...provided,
            background: 'var(--bg-color)',
            border: '1px solid var(--card-border)',
            zIndex: 9999
        }),
        menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
        option: (provided, state) => ({
            ...provided,
            background: state.isFocused ? 'var(--card-hover)' : 'var(--bg-color)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        }),
        multiValue: (provided) => ({
            ...provided,
            background: 'var(--card-hover)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center'
        }),
        multiValueLabel: (provided) => ({
            ...provided,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        }),
        multiValueRemove: (provided) => ({
            ...provided,
            color: 'var(--text-primary)',
            '&:hover': { background: 'transparent', color: 'red' }
        })
    };

    const countryOptions = countriesList.map(c => ({
        value: c.name.common,
        label: c.name.common,
        cca2: c.cca2 ? c.cca2.toLowerCase() : ''
    }));

    const prefOptions = [
        {
            value: 'Global',
            label: 'Match Globally / Any',
            isGlobal: true
        },
        ...countryOptions
    ];

    const formatOptionLabel = ({ label, cca2, isGlobal }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isGlobal ? (
                <span style={{ fontSize: '1.1rem' }}>🌎</span>
            ) : (
                <span className={`fi fi-${cca2}`} style={{ borderRadius: '2px' }}></span>
            )}
            <span>{label}</span>
        </div>
    );

    const genderOptions = [
        { value: 'Male', label: 'Male', icon: '/male_icon.png' },
        { value: 'Female', label: 'Female', icon: '/female_icon.png' }
    ];

    const targetGenderOptions = [
        { value: 'Anyone', label: 'Anyone', isGlobal: true },
        ...genderOptions
    ];

    const formatGenderLabel = ({ label, icon, isGlobal }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isGlobal ? (
                <span style={{ fontSize: '1.2rem' }}>🌎</span>
            ) : (
                <img src={icon} alt={label} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            )}
            <span>{label}</span>
        </div>
    );

    const handlePrefChange = (selected) => {
        const selectedArr = selected || [];
        // If a country is added to preferred, remove it from blocked
        setPreferences(prev => {
            const newBlocked = (prev.blockedCountry || []).filter(
                b => !selectedArr.some(s => s.value === b.value)
            );
            return { 
                ...prev, 
                targetCountry: selectedArr,
                blockedCountry: newBlocked
            };
        });
    };

    const handleBlockChange = (selected) => {
        const selectedArr = selected || [];
        // If a country is added to blocked, remove it from preferred
        setPreferences(prev => {
            const newTarget = (prev.targetCountry || []).filter(
                t => !selectedArr.some(s => s.value === t.value)
            );
            return { 
                ...prev, 
                blockedCountry: selectedArr,
                targetCountry: newTarget
            };
        });
    };
    const handleUserGender = (selected) => setPreferences(prev => ({ ...prev, userGender: selected?.value || 'Male' }));
    const handleTargetGender = (selected) => setPreferences(prev => ({ ...prev, targetGender: selected?.value || 'Anyone' }));

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 2000,
                        animation: 'fadeIn 0.4s ease'
                    }}
                />
            )}

            {/* Sidebar Drawer */}
            <aside style={{
                position: 'fixed',
                top: 0, right: 0,
                width: 'min(400px, 95vw)',
                height: '100vh',
                background: 'var(--card-bg)',
                backdropFilter: 'var(--glass-blur)',
                borderLeft: '1px solid var(--card-border)',
                boxShadow: '-10px 0 50px rgba(0,0,0,0.2)',
                zIndex: 2100,
                display: 'flex',
                flexDirection: 'column',
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                overflowY: 'auto',
                paddingTop: 'env(safe-area-inset-top)'
            }}>
                {/* Header */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '2rem 1.5rem', 
                    borderBottom: '1px solid var(--card-border)',
                    background: 'rgba(0,0,0,0.02)'
                }}>
                    <h2 style={{ 
                        margin: 0, 
                        fontSize: '1.5rem', 
                        fontWeight: 700, 
                        fontFamily: 'var(--font-heading)',
                        color: 'var(--text-primary)' 
                    }}>Match Preferences</h2>
                    <button onClick={onClose} style={{ 
                        background: 'var(--card-hover)', 
                        border: '1px solid var(--card-border)', 
                        borderRadius: '12px',
                        padding: '8px',
                        cursor: 'pointer', 
                        color: 'var(--text-primary)', 
                        display: 'flex', 
                        alignItems: 'center',
                        transition: 'var(--transition)'
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1 }}>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>I am a</label>
                        <Select
                            options={genderOptions}
                            value={genderOptions.find(o => o.value === preferences.userGender)}
                            onChange={handleUserGender}
                            formatOptionLabel={formatGenderLabel}
                            styles={customStyles}
                            menuPortalTarget={document.body}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Looking for</label>
                        <Select
                            options={targetGenderOptions}
                            value={targetGenderOptions.find(o => o.value === preferences.targetGender)}
                            onChange={handleTargetGender}
                            formatOptionLabel={formatGenderLabel}
                            styles={customStyles}
                            menuPortalTarget={document.body}
                        />
                    </div>

                    <hr style={{ borderColor: 'var(--card-border)', margin: '0' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative', zIndex: 2 }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preferred Country</label>
                        <Select
                            isMulti
                            options={prefOptions}
                            value={preferences.targetCountry}
                            onChange={handlePrefChange}
                            formatOptionLabel={formatOptionLabel}
                            styles={customStyles}
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                            placeholder="Match Globally / Any..."
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative', zIndex: 1 }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Block Countries</label>
                        <Select
                            isMulti
                            options={countryOptions}
                            value={preferences.blockedCountry}
                            onChange={handleBlockChange}
                            formatOptionLabel={formatOptionLabel}
                            styles={customStyles}
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                            placeholder="None (allow all)..."
                        />
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Preferences;
