import AddEventModal from '../AddEventModal';
import AuthModal from '../AuthModal';
import TagRatingsModal from '../TagRatingsModal';
import GlobalCreateListModal from './GlobalCreateListModal';
import type { AppSettings } from '../../types/appSettings';
import type { OverlaySource } from '../../contexts/AppChromeContext';

type AppSharedModalsProps = {
  appSettings: AppSettings | null | undefined;
  isAddEventModalOpen: boolean;
  isCreateListModalOpen: boolean;
  isAuthModalOpen: boolean;
  isTagRatingsModalOpen: boolean;
  tagRatingsData: { type: string; value: string } | null;
  modalAuthMode: 'signin' | 'signup';
  modalAuthPrompt: string | undefined;
  tagModalRefreshTrigger: number;
  onCloseAppModal: () => void;
  onCloseAuthModal: () => void;
  onEventAdded: (eventId: string) => void;
  onOpenEventOverlay: (eventId: string, source?: OverlaySource) => void;
  onOpenTagModal: (type: string, value: string) => void;
};

export default function AppSharedModals({
  appSettings,
  isAddEventModalOpen,
  isCreateListModalOpen,
  isAuthModalOpen,
  isTagRatingsModalOpen,
  tagRatingsData,
  modalAuthMode,
  modalAuthPrompt,
  tagModalRefreshTrigger,
  onCloseAppModal,
  onCloseAuthModal,
  onEventAdded,
  onOpenEventOverlay,
  onOpenTagModal,
}: AppSharedModalsProps) {
  return (
    <>
      <AddEventModal isOpen={isAddEventModalOpen} onClose={onCloseAppModal} onEventAdded={onEventAdded} />
      <GlobalCreateListModal isOpen={isCreateListModalOpen} onClose={onCloseAppModal} />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={onCloseAuthModal}
        initialMode={modalAuthMode}
        promptMessage={modalAuthPrompt}
        privacyUrl={appSettings?.privacy_policy_url}
        termsUrl={appSettings?.terms_of_service_url}
      />
      {isTagRatingsModalOpen && (
        <TagRatingsModal
          isOpen={isTagRatingsModalOpen}
          onClose={onCloseAppModal}
          tagType={tagRatingsData?.type || ''}
          tagValue={tagRatingsData?.value || ''}
          onEventClick={(eventId) => onOpenEventOverlay(eventId, 'tagModal')}
          refreshTrigger={tagModalRefreshTrigger}
          tagColors={appSettings}
          onTagClick={onOpenTagModal}
        />
      )}
    </>
  );
}
