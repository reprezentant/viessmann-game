import { Tooltip } from './Tooltip';
import type { OwnedDevices, GameItem, ResKey } from '../types';

interface DeviceStatusProps {
  owned: OwnedDevices;
  deviceItems: GameItem[];
  productionItems: GameItem[];
  effectiveRates: Record<ResKey, number>;
}

export function DeviceStatus({ owned, deviceItems, productionItems, effectiveRates }: DeviceStatusProps) {
  const allItems = [...deviceItems, ...productionItems];
  
  const getDeviceTooltip = (item: GameItem) => {
    const count = owned[item.key] || 0;
    if (count === 0) return null;

    return (
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          {item.name} (x{count})
        </div>
        <div style={{ marginBottom: '8px', opacity: 0.9 }}>
          {item.description}
        </div>
        
        {/* Show production effects */}
        <div style={{ fontSize: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Efekty:</div>
          
          {/* Resource production */}
          {effectiveRates.sun > 0 && item.key === 'heatpump' && (
            <div>• Słońce: +{(effectiveRates.sun * 0.3).toFixed(1)}/s</div>
          )}
          {effectiveRates.coins > 0 && ['coal', 'pellet', 'gas', 'floor', 'thermostat'].includes(item.key) && (
            <div>• Monety: +{(count * 0.1).toFixed(1)}/s</div>
          )}
          
          {/* Special effects */}
          {item.key === 'pellet' && <div>• Odblokowuje źródła odnawialne</div>}
          {item.key === 'heatpump' && <div>• Wysokowydajny system</div>}
          {item.key === 'thermostat' && <div>• Optymalizuje zużycie energii</div>}
          {item.key === 'floor' && <div>• Zwiększa efektywność grzania</div>}
          {item.key === 'coal' && <div style={{ color: '#ef4444' }}>• Zwiększa zanieczyszczenie</div>}
        </div>
      </div>
    );
  };

  const ownedDevices = allItems.filter(item => (owned[item.key] || 0) > 0);

  if (ownedDevices.length === 0) {
    return (
      <div style={{ 
        padding: '16px', 
        textAlign: 'center',
        fontSize: '14px',
        color: '#6b7280',
        fontStyle: 'italic'
      }}>
        Brak zakupionych urządzeń
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ 
        margin: '0 0 12px 0', 
        fontSize: '16px', 
        fontWeight: 'bold',
        color: '#1f2937',
        textAlign: 'center'
      }}>
        Dom i otoczenie
      </h3>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '8px'
      }}>
        {ownedDevices.map(item => {
          const count = owned[item.key] || 0;
          const tooltipContent = getDeviceTooltip(item);
          
          return (
            <Tooltip key={item.key} content={tooltipContent}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'help',
                transition: 'all 0.2s ease'
              }}>
                <span style={{ fontSize: '16px', marginRight: '6px' }}>
                  {item.icon}
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ 
                    fontWeight: '500', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {item.name}
                  </div>
                  <div style={{ 
                    color: '#6b7280', 
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    x{count}
                  </div>
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
