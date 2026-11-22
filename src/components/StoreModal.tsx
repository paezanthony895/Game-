import React, { useState } from 'react';
import { Coins, Check, Lock, ShoppingBag, Sparkles, Shield, Trophy, X } from 'lucide-react';
import type { ProgressionStoreState, UnlockableCategory, UnlockableItem } from '../types/football';
import { UNLOCKABLE_ITEMS } from '../storage/saveManager';
import { soundEngine } from '../audio/soundEngine';

export interface StoreModalProps {
  store: ProgressionStoreState;
  onPurchaseItem: (itemId: string) => void;
  onEquipItem: (itemId: string) => void;
  onClose?: () => void;
  isModal?: boolean;
}

const CATEGORY_TABS: { id: UnlockableCategory; label: string; subtitle: string }[] = [
  {
    id: 'ball',
    label: 'Pelotas Especiales',
    subtitle: 'Balones clásicos, dorados y de alta visibilidad en cancha 3D',
  },
  {
    id: 'retro_kit',
    label: 'Camisetas Retro',
    subtitle: 'Equipaciones históricas y ediciones de colección',
  },
  {
    id: 'stadium_theme',
    label: 'Estadios Monumentales',
    subtitle: 'Arquitectura, iluminación LED y atmósfera de coliseo',
  },
];

export const StoreModal: React.FC<StoreModalProps> = ({
  store,
  onPurchaseItem,
  onEquipItem,
  onClose,
  isModal = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<UnlockableCategory>('ball');

  const itemsInCategory = UNLOCKABLE_ITEMS.filter((it) => it.category === activeCategory);

  const isEquipped = (item: UnlockableItem): boolean => {
    if (item.category === 'ball') return store.equippedBallId === item.id;
    if (item.category === 'retro_kit') return store.equippedRetroKitId === item.id;
    return store.equippedStadiumThemeId === item.id;
  };

  const content = (
    <div
      data-testid="store-container"
      className="rounded-2xl bg-[#101923] border border-slate-800 p-4 sm:p-6 space-y-5 shadow-2xl"
    >
      {/* Store Header & Coin Wallet */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
            <ShoppingBag className="w-4 h-4" />
            <span>TIENDA ATLAS PRO · PROGRESIÓN Y DESBLOQUEABLES</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Colección Oficial de Balones, Camisetas Retro y Estadios
          </h2>
          <p className="text-xs text-slate-400">
            Gana monedas en cada partido (+bono por goles, victorias y títulos de Copa) y equipa tus artículos en el motor 3D.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <div
            data-testid="store-coins-balance"
            className="flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-400/50 px-4 py-2 shadow-lg"
          >
            <Coins className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Saldo Disponible
              </div>
              <div className="font-mono-tabular text-lg font-black text-white">
                {store.coins} <span className="text-xs font-bold text-amber-300">Monedas</span>
              </div>
            </div>
          </div>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar tienda"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Cerrar</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Switcher Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {CATEGORY_TABS.map((tab) => {
          const active = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`store-tab-${tab.id}`}
              onClick={() => {
                soundEngine.playUiClick();
                setActiveCategory(tab.id);
              }}
              className={`rounded-xl p-3.5 border text-left transition-all cursor-pointer ${
                active
                  ? 'bg-emerald-950/60 border-emerald-400 text-white shadow-lg'
                  : 'bg-slate-950/75 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="font-display text-base font-extrabold">{tab.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{tab.subtitle}</div>
            </button>
          );
        })}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {itemsInCategory.map((item) => {
          const unlocked = (store.unlockedItemIds ?? []).includes(item.id);
          const equipped = isEquipped(item);
          const canAfford = store.coins >= item.price;

          return (
            <div
              key={item.id}
              data-testid={`store-item-${item.id}`}
              className={`rounded-xl border p-4 flex flex-col justify-between gap-4 transition-all ${
                equipped
                  ? 'bg-emerald-950/35 border-emerald-400 shadow-lg'
                  : unlocked
                    ? 'bg-slate-950/85 border-slate-700'
                    : 'bg-slate-950/60 border-slate-800/90'
              }`}
            >
              <div className="space-y-3">
                {/* Preview Swatch & Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-11 h-11 rounded-xl border-2 border-white/30 shadow-inner flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${item.previewColor} 0%, ${item.secondaryColor} 70%, ${item.accentColor ?? item.previewColor} 100%)`,
                      }}
                    >
                      {item.category === 'ball' ? (
                        <Sparkles className="w-5 h-5 text-white drop-shadow" />
                      ) : item.category === 'retro_kit' ? (
                        <Shield className="w-5 h-5 text-white drop-shadow" />
                      ) : (
                        <Trophy className="w-5 h-5 text-white drop-shadow" />
                      )}
                    </div>
                    <div>
                      <div className="font-display text-lg font-extrabold text-white leading-tight">
                        {item.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="w-3 h-3 rounded-full border border-white/40"
                          style={{ backgroundColor: item.previewColor }}
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-white/40"
                          style={{ backgroundColor: item.secondaryColor }}
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-white/40"
                          style={{ backgroundColor: item.accentColor ?? item.previewColor }}
                        />
                      </div>
                    </div>
                  </div>

                  {equipped ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-400/50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                      <Check className="w-3 h-3" />
                      <span>EQUIPADO</span>
                    </span>
                  ) : unlocked ? (
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      EN COLECCIÓN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[11px] font-mono-tabular font-extrabold text-amber-300">
                      <Coins className="w-3 h-3" />
                      <span>{item.price}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
              </div>

              {/* Action Button */}
              <div>
                {equipped ? (
                  <button
                    type="button"
                    disabled
                    data-testid={`btn-equipped-${item.id}`}
                    className="w-full rounded-lg bg-emerald-600/30 border border-emerald-400/50 py-2.5 text-xs font-extrabold text-emerald-200 cursor-default"
                  >
                    ✓ Equipado para el Partido 3D
                  </button>
                ) : unlocked ? (
                  <button
                    type="button"
                    data-testid={`btn-equip-${item.id}`}
                    onClick={() => {
                      soundEngine.playUiClick();
                      onEquipItem(item.id);
                    }}
                    className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-extrabold text-white shadow cursor-pointer"
                  >
                    Equipar Ahora
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford}
                    data-testid={`btn-buy-${item.id}`}
                    onClick={() => {
                      soundEngine.playUiClick();
                      onPurchaseItem(item.id);
                    }}
                    className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-extrabold transition-colors ${
                      canAfford
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow cursor-pointer'
                        : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {canAfford ? (
                      <>
                        <Coins className="w-3.5 h-3.5" />
                        <span>Desbloquear por {item.price} Monedas</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Faltan {item.price - store.coins} Monedas</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (!isModal) {
    return content;
  }

  return (
    <div
      data-testid="store-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-5xl my-auto max-h-[92dvh] overflow-y-auto">{content}</div>
    </div>
  );
};
