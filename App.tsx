import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard as RNKeyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const fallbackCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'] as const;

const fallbackNames: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  CHF: 'Swiss Franc',
};

const baseRates: Record<(typeof fallbackCurrencies)[number], number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 155.8,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.86,
};

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
  CHF: 'CHF',
};

const sanitizeNumber = (value: string) => value.replace(/[^0-9.,]/g, '');
const parseNumber = (value: string) => Number(value.replace(',', '.'));
const formatAmount = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

const deriveRatesFromFallback = (base: string) => {
  if (!baseRates[base as keyof typeof baseRates]) return baseRates;
  const usdPerBase = 1 / baseRates[base as keyof typeof baseRates];
  const entries = Object.entries(baseRates).map(([code, rate]) => [code, usdPerBase * rate]);
  return Object.fromEntries(entries) as Record<string, number>;
};

type Target = 'from' | 'to';

const keypadLayout = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

const CONTAINER_BOTTOM_PADDING = 16;

type SectionProps = {
  currency: string;
  currencyName?: string;
  symbol: string;
  amount: string;
  active: boolean;
  onFocus: () => void;
  onCurrencyPress: () => void;
};

const CurrencySection = ({
  currency,
  currencyName,
  symbol,
  amount,
  active,
  onFocus,
  onCurrencyPress,
}: SectionProps) => {
  const displayAmount = amount === '' ? '0' : amount;

  return (
    <Pressable
      style={[styles.section, active ? styles.sectionActive : styles.sectionInactive]}
      onPress={onFocus}
    >
      <View style={styles.sectionHeader}>
        <Pressable
          style={styles.selector}
          onPress={(event) => {
            event.stopPropagation();
            onCurrencyPress();
          }}
        >
          <Text style={styles.selectorCode}>{currency}</Text>
          <Text style={styles.selectorChevron}>⌄</Text>
        </Pressable>
      </View>
      <View style={styles.amountRow}>
        <Text style={styles.amountSymbol}>{symbol}</Text>
        <Text style={[styles.amountText, !active && styles.amountMuted]} numberOfLines={1}>
          {displayAmount}
        </Text>
      </View>
      <Text style={styles.currencyLabel}>{currencyName ?? 'Devise'}</Text>
    </Pressable>
  );
};

type PickerProps = {
  visible: boolean;
  currencies: string[];
  currencyNames: Record<string, string>;
  selected: string;
  searchTerm: string;
  bottomOffset: number;
  onSearch: (value: string) => void;
  onSelect: (code: string) => void;
  onClose: () => void;
};

const CurrencyPicker = ({
  visible,
  currencies,
  currencyNames,
  selected,
  searchTerm,
  bottomOffset,
  onSearch,
  onSelect,
  onClose,
}: PickerProps) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <TouchableWithoutFeedback onPress={onClose} accessible={false}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalShade, { bottom: bottomOffset || 0 }]} />
        <TouchableWithoutFeedback>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
            style={[styles.modalAvoider, { paddingBottom: bottomOffset || 0 }]}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choisir une monnaie</Text>
                <Pressable onPress={onClose} hitSlop={10}>
                  <Text style={styles.selectorChevron}>✕</Text>
                </Pressable>
              </View>

              <TextInput
                value={searchTerm}
                onChangeText={onSearch}
                placeholder="Rechercher un code ou nom…"
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
                autoFocus
              />

              <FlatList
                data={currencies}
                keyExtractor={(item) => item}
                renderItem={({ item }) => {
                  const name = currencyNames[item] ?? '—';
                  const isSelected = item === selected;
                  return (
                    <Pressable style={styles.currencyRow} onPress={() => onSelect(item)}>
                      <View style={styles.currencyTextBlock}>
                        <Text style={styles.currencyCodeText}>{item}</Text>
                        <Text style={styles.currencyNameText}>{name}</Text>
                      </View>
                      {isSelected ? <Text style={styles.currencyCheck}>✓</Text> : null}
                    </Pressable>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
                contentContainerStyle={styles.modalList}
                keyboardShouldPersistTaps="handled"
              />

              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>Fermer</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
);

type KeypadProps = {
  onPressKey: (key: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

const Keypad = ({ onPressKey, onLayout }: KeypadProps) => (
  <View style={styles.keypad} onLayout={onLayout}>
    {keypadLayout.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.keyRow}>
        {row.map((key) => (
          <Pressable
            key={key}
            style={[
              styles.key,
              key === 'backspace' ? styles.keyBackspace : null,
              key === '.' ? styles.keyGhost : null,
            ]}
            onPress={() => onPressKey(key)}
          >
            <Text
              style={[
                styles.keyLabel,
                key === 'backspace' ? styles.keyLabelInverse : null,
              ]}
            >
              {key === 'backspace' ? '⌫' : key}
            </Text>
          </Pressable>
        ))}
      </View>
    ))}
  </View>
);

function AppContent() {
  const apiKey = process.env.EXPO_PUBLIC_EXCHANGERATE_API_KEY;
  const [currencies, setCurrencies] = useState<string[]>([...fallbackCurrencies]);
  const [currencyNames, setCurrencyNames] = useState<Record<string, string>>(fallbackNames);
  const [rates, setRates] = useState<Record<string, number>>(deriveRatesFromFallback('USD'));
  const [fromCurrency, setFromCurrency] = useState<string>('EUR');
  const [toCurrency, setToCurrency] = useState<string>('USD');
  const [amountFrom, setAmountFrom] = useState('0');
  const [amountTo, setAmountTo] = useState('0.00');
  const [activeInput, setActiveInput] = useState<Target>('from');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState<Target>('from');
  const [usingFallback, setUsingFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [keypadHeight, setKeypadHeight] = useState(0);
  const { bottom: insetBottom } = useSafeAreaInsets();

  const statusColor = useMemo(() => {
    if (loading) return '#f59e0b';
    return usingFallback ? '#f97316' : '#22d3ee';
  }, [loading, usingFallback]);

  const rate = useMemo(() => {
    if (!rates[fromCurrency] || !rates[toCurrency]) return 1;
    return rates[toCurrency] / rates[fromCurrency];
  }, [fromCurrency, toCurrency, rates]);

  useEffect(() => {
    const loadSymbolsAndRates = async () => {
      setLoading(true);
      if (!apiKey) {
        setCurrencies([...fallbackCurrencies]);
        setCurrencyNames(fallbackNames);
        setRates(deriveRatesFromFallback('USD'));
        setUsingFallback(true);
        setLoading(false);
        return;
      }

      const codesUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/codes`;
      const ratesUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;

      try {
        const [codesRes, ratesRes] = await Promise.all([fetch(codesUrl), fetch(ratesUrl)]);

        const codesJson = codesRes.ok ? await codesRes.json() : null;
        const ratesJson = ratesRes.ok ? await ratesRes.json() : null;

        const codesSuccess = codesJson?.result === 'success' && Array.isArray(codesJson.supported_codes);
        const ratesSuccess = ratesJson?.result === 'success' && ratesJson.conversion_rates;

        if (codesSuccess) {
          const pairs = codesJson.supported_codes as [string, string][];
          const codes = pairs.map(([code]) => code).sort();
          const names = Object.fromEntries(pairs);
          setCurrencies(codes);
          setCurrencyNames(names);
        } else {
          setCurrencies([...fallbackCurrencies]);
          setCurrencyNames(fallbackNames);
        }

        if (ratesSuccess) {
          const incoming = ratesJson.conversion_rates as Record<string, number>;
          const baseCode = (ratesJson.base_code as string) || 'USD';
          setRates({ ...incoming, [baseCode]: 1 });
        } else {
          setRates(deriveRatesFromFallback('USD'));
        }

        setUsingFallback(!(codesSuccess && ratesSuccess));
      } catch {
        setCurrencies([...fallbackCurrencies]);
        setCurrencyNames(fallbackNames);
        setRates(deriveRatesFromFallback('USD'));
        setUsingFallback(true);
      } finally {
        setLoading(false);
      }
    };

    loadSymbolsAndRates();
  }, [apiKey]);

  useEffect(() => {
    if (activeInput === 'from') {
      const parsed = parseNumber(amountFrom);
      setAmountTo(formatAmount(parsed * rate));
    } else {
      const parsed = parseNumber(amountTo);
      setAmountFrom(formatAmount(parsed / rate));
    }
  }, [rate, activeInput, amountFrom, amountTo, fromCurrency, toCurrency]);

  const setFromValue = (value: string) => {
    const clean = sanitizeNumber(value);
    setActiveInput('from');
    setAmountFrom(clean);
    const parsed = parseNumber(clean);
    setAmountTo(formatAmount(parsed * rate));
  };

  const setToValue = (value: string) => {
    const clean = sanitizeNumber(value);
    setActiveInput('to');
    setAmountTo(clean);
    const parsed = parseNumber(clean);
    setAmountFrom(formatAmount(parsed / rate));
  };

  const handleKeyPress = (key: string) => {
    const current = activeInput === 'from' ? amountFrom : amountTo;
    let next = current || '';

    if (key === 'backspace') {
      next = next.slice(0, -1);
    } else if (key === '.') {
      if (next.includes('.')) {
        return;
      }
      next = next ? `${next}.` : '0.';
    } else {
      next = next === '0' ? key : `${next}${key}`;
    }

    if (activeInput === 'from') {
      setFromValue(next);
    } else {
      setToValue(next);
    }
  };

  const swap = () => {
    const prevFrom = fromCurrency;
    const prevTo = toCurrency;
    const prevAmountTo = amountTo;
    setFromCurrency(prevTo);
    setToCurrency(prevFrom);
    setAmountFrom(prevAmountTo);
    setActiveInput('from');
  };

  const openModal = (target: Target) => {
    setModalTarget(target);
    setModalVisible(true);
    setSearchTerm('');
  };

  const closeModal = () => {
    setModalVisible(false);
    setSearchTerm('');
  };

  const selectCurrency = (code: string) => {
    if (modalTarget === 'from') {
      setFromCurrency(code);
    } else {
      setToCurrency(code);
    }
    closeModal();
  };

  const filteredCurrencies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return currencies;
    return currencies.filter((code) => {
      const name = currencyNames[code]?.toLowerCase() ?? '';
      return code.toLowerCase().includes(term) || name.includes(term);
    });
  }, [currencies, currencyNames, searchTerm]);

  const modalBottomOffset = Math.max(keypadHeight + insetBottom, 0);

  return (
    <SafeAreaView style={styles.screen}>
      <TouchableWithoutFeedback onPress={RNKeyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <View style={styles.container}>
            <View style={styles.sectionStack}>
              <CurrencySection
                currency={fromCurrency}
                currencyName={currencyNames[fromCurrency]}
                symbol={currencySymbols[fromCurrency] ?? fromCurrency}
                amount={amountFrom}
                active={activeInput === 'from'}
                onFocus={() => setFromValue('0')}
                onCurrencyPress={() => openModal('from')}
              />
              <View style={styles.divider} />
              <CurrencySection
                currency={toCurrency}
                currencyName={currencyNames[toCurrency]}
                symbol={currencySymbols[toCurrency] ?? toCurrency}
                amount={amountTo}
                active={activeInput === 'to'}
                onFocus={() => setToValue('0')}
                onCurrencyPress={() => openModal('to')}
              />

              <Pressable style={styles.swapButton} onPress={swap}>
                <Text style={styles.swapIcon}>⇅</Text>
              </Pressable>
            </View>

            <View style={styles.rateRow}>
              <Text style={styles.rateText}>
                1 {fromCurrency} = {rate.toFixed(4)} {toCurrency}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>
                  {loading ? 'Mise à jour' : usingFallback ? 'Taux locaux' : 'Taux en direct'}
                </Text>
              </View>
            </View>

            <Keypad
              onPressKey={handleKeyPress}
              onLayout={(event) => setKeypadHeight(event.nativeEvent.layout.height)}
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <CurrencyPicker
        visible={modalVisible}
        currencies={filteredCurrencies}
        currencyNames={currencyNames}
        selected={modalTarget === 'from' ? fromCurrency : toCurrency}
        searchTerm={searchTerm}
        bottomOffset={modalBottomOffset}
        onSearch={setSearchTerm}
        onSelect={selectCurrency}
        onClose={closeModal}
      />

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: CONTAINER_BOTTOM_PADDING,
    gap: 16,
  },
  sectionStack: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },
  section: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  sectionActive: {
    backgroundColor: '#f7f7fa',
  },
  sectionInactive: {
    backgroundColor: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorCode: {
    color: '#1f2937',
    fontSize: 24,
    fontWeight: '700',
  },
  selectorChevron: {
    color: '#6b7280',
    fontSize: 18,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  amountSymbol: {
    color: '#9ca3af',
    fontSize: 30,
    marginBottom: 2,
  },
  amountText: {
    color: '#111827',
    fontSize: 50,
    fontWeight: '200',
    letterSpacing: 0.5,
  },
  amountMuted: {
    color: '#d1d5db',
  },
  currencyLabel: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  swapButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -32 }, { translateY: -32 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 5,
  },
  swapIcon: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 22,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  rateText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 12,
  },
  keypad: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  key: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
  },
  keyGhost: {
    backgroundColor: '#f8fafc',
  },
  keyBackspace: {
    backgroundColor: '#0f172a',
  },
  keyLabel: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '500',
  },
  keyLabelInverse: {
    color: '#fff',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(205, 156, 156, 0.25)',
  },
  modalAvoider: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalList: {
    paddingBottom: 12,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  currencyTextBlock: {
    flex: 1,
  },
  currencyCodeText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  currencyNameText: {
    color: '#6b7280',
    marginTop: 2,
  },
  currencyCheck: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#eceff4',
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  closeText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 15,
  },
});
