import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createUserPlaylist, fetchUserPlaylists } from '../../lib/userLists';
import { listPagePath } from '../../lib/siteBase';
import { fetchUserPublicHandle } from '../../lib/userProfile';
import CreateListModal from '../profile/CreateListModal';

type GlobalCreateListModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function GlobalCreateListModal({ isOpen, onClose }: GlobalCreateListModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setIsPrivate(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const { data: lists, error: fetchError } = await fetchUserPlaylists(user.id);
    if (fetchError) {
      setError(fetchError.message || 'Failed to create list');
      return;
    }

    const { data: list, error: createError } = await createUserPlaylist(user.id, name, {
      description,
      isPublic: !isPrivate,
      sortOrder: lists.length,
    });
    if (createError || !list) {
      setError(createError?.message || 'Failed to create list');
      return;
    }

    const handle = await fetchUserPublicHandle(user.id);
    onClose();
    if (handle) {
      navigate(listPagePath(handle, list.id));
    }
  };

  return (
    <CreateListModal
      name={name}
      description={description}
      isPrivate={isPrivate}
      error={error}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onPrivateChange={setIsPrivate}
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}
