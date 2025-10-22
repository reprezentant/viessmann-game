import React from 'react';
import img from '../assets/ui/ViCoin_LM.png';

export default function ViCoin({ size = 16, alt = 'ViCoin', style }: { size?: number; alt?: string; style?: React.CSSProperties }) {
  return <img src={img} alt={alt} width={size} height={size} style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle', ...style }} />;
}
