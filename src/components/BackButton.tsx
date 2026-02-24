import React from 'react';
import { SquareArrowLeft } from 'lucide-react';
import './BackButton.css';

interface BackButtonProps {
  onClick: () => void;
}

const BackButton: React.FC<BackButtonProps> = ({ onClick }) => {
  return (
    <button className="back-button" onClick={onClick} title="戻る">
      <SquareArrowLeft size={20} />
      <span>戻る</span>
    </button>
  );
};

export default BackButton;
