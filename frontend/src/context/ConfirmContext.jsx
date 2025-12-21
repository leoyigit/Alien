import React, { createContext, useContext, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';

const ConfirmContext = createContext();

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider');
    }
    return context;
};

export const ConfirmProvider = ({ children }) => {
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        message: '',
        variant: 'danger',
        resolve: null
    });

    const confirm = ({ title, message, variant = 'danger' }) => {
        return new Promise((resolve) => {
            setConfirmState({
                isOpen: true,
                title,
                message,
                variant,
                resolve
            });
        });
    };

    const handleConfirm = () => {
        if (confirmState.resolve) {
            confirmState.resolve(true);
        }
        setConfirmState({ ...confirmState, isOpen: false });
    };

    const handleClose = () => {
        if (confirmState.resolve) {
            confirmState.resolve(false);
        }
        setConfirmState({ ...confirmState, isOpen: false });
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={handleClose}
                onConfirm={handleConfirm}
                title={confirmState.title}
                message={confirmState.message}
                variant={confirmState.variant}
            />
        </ConfirmContext.Provider>
    );
};
