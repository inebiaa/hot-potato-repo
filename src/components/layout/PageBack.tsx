import { BackIconButton } from '../ui';
import { useAppChrome } from '../../contexts/AppChromeContext';
import { useT } from '../../hooks/useCopy';

type PageBackProps = {
  className?: string;
  /** Override for in-page stack (e.g. profile board → library). */
  onClick?: () => void;
};

/** Standard page back: previous screen, or home when there is no history. */
export default function PageBack({ className, onClick }: PageBackProps) {
  const t = useT();
  const { goBack } = useAppChrome();
  return (
    <BackIconButton onClick={onClick ?? goBack} label={t('nav.back')} className={className} />
  );
}
