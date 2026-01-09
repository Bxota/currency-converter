import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard as RNKeyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  useColorScheme,
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

type ThemeName = 'light' | 'dark';

type Theme = {
  screen: string;
  card: string;
  cardActive: string;
  cardInactive: string;
  cardBorder: string;
  shadow: string;
  selectorText: string;
  selectorChevron: string;
  amountSymbol: string;
  amountText: string;
  amountMuted: string;
  label: string;
  divider: string;
  swapBackground: string;
  swapIcon: string;
  rateText: string;
  statusText: string;
  keypadBackground: string;
  keypadBorder: string;
  keyBackground: string;
  keyGhost: string;
  keyBackspace: string;
  keyPressed: string;
  keyPressedBackspace: string;
  keyLabel: string;
  keyLabelInverse: string;
  keyRipple: string;
  keyRippleStrong: string;
  modalShade: string;
  modalCard: string;
  modalTitle: string;
  searchBackground: string;
  searchBorder: string;
  searchText: string;
  placeholder: string;
  currencyName: string;
  rowDivider: string;
  closeText: string;
  statusBarStyle: 'light' | 'dark';
};

const themes: Record<ThemeName, Theme> = {
  light: {
    screen: '#fff',
    card: '#fff',
    cardActive: '#f7f7fa',
    cardInactive: '#fff',
    cardBorder: '#e5e7eb',
    shadow: '#0f172a',
    selectorText: '#1f2937',
    selectorChevron: '#6b7280',
    amountSymbol: '#9ca3af',
    amountText: '#111827',
    amountMuted: '#d1d5db',
    label: '#6b7280',
    divider: '#e5e7eb',
    swapBackground: '#000',
    swapIcon: '#fff',
    rateText: '#111827',
    statusText: '#0f172a',
    keypadBackground: '#f3f4f6',
    keypadBorder: '#e5e7eb',
    keyBackground: '#fff',
    keyGhost: '#f8fafc',
    keyBackspace: '#0f172a',
    keyPressed: '#eef2ff',
    keyPressedBackspace: '#111827',
    keyLabel: '#0f172a',
    keyLabelInverse: '#fff',
    keyRipple: '#e5e7eb',
    keyRippleStrong: '#1f2937',
    modalShade: 'rgba(205, 156, 156, 0.25)',
    modalCard: '#fff',
    modalTitle: '#0f172a',
    searchBackground: '#f8fafc',
    searchBorder: '#e5e7eb',
    searchText: '#0f172a',
    placeholder: '#94a3b8',
    currencyName: '#6b7280',
    rowDivider: '#eceff4',
    closeText: '#111827',
    statusBarStyle: 'dark',
  },
  dark: {
    screen: '#0b1220',
    card: '#0f172a',
    cardActive: '#111c2d',
    cardInactive: '#0f172a',
    cardBorder: '#1f2937',
    shadow: '#000',
    selectorText: '#e5e7eb',
    selectorChevron: '#cbd5e1',
    amountSymbol: '#cbd5e1',
    amountText: '#e5e7eb',
    amountMuted: '#475569',
    label: '#cbd5e1',
    divider: '#1f2937',
    swapBackground: '#f59e0b',
    swapIcon: '#0b1220',
    rateText: '#e2e8f0',
    statusText: '#0b1220',
    keypadBackground: '#111827',
    keypadBorder: '#1f2937',
    keyBackground: '#0f172a',
    keyGhost: '#111827',
    keyBackspace: '#f59e0b',
    keyPressed: '#1e293b',
    keyPressedBackspace: '#fbbf24',
    keyLabel: '#e2e8f0',
    keyLabelInverse: '#0b1220',
    keyRipple: '#1f2937',
    keyRippleStrong: '#fcd34d',
    modalShade: 'rgba(8, 15, 26, 0.7)',
    modalCard: '#0f172a',
    modalTitle: '#e5e7eb',
    searchBackground: '#111827',
    searchBorder: '#1f2937',
    searchText: '#e2e8f0',
    placeholder: '#94a3b8',
    currencyName: '#cbd5e1',
    rowDivider: '#1f2937',
    closeText: '#e5e7eb',
    statusBarStyle: 'light',
  },
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: {
      flex: 1,
      backgroundColor: theme.screen,
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
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 6,
      marginBottom: 4,
    },
    appTitle: {
      color: theme.amountText,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    sectionStack: {
      flex: 1,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: theme.cardInactive,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      position: 'relative',
      shadowColor: theme.shadow,
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
      backgroundColor: theme.cardActive,
    },
    sectionInactive: {
      backgroundColor: theme.cardInactive,
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
      color: theme.selectorText,
      fontSize: 24,
      fontWeight: '700',
    },
    selectorChevron: {
      color: theme.selectorChevron,
      fontSize: 18,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    amountSymbol: {
      color: theme.amountSymbol,
      fontSize: 30,
      marginBottom: 2,
    },
    amountText: {
      color: theme.amountText,
      fontSize: 50,
      fontWeight: '200',
      letterSpacing: 0.5,
    },
    amountMuted: {
      color: theme.amountMuted,
    },
    currencyLabel: {
      marginTop: 8,
      color: theme.label,
      fontSize: 14,
    },
    divider: {
      height: 1,
      backgroundColor: theme.divider,
    },
    swapButton: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.swapBackground,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ translateX: -32 }, { translateY: -32 }],
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 14,
      elevation: 12,
      zIndex: 5,
    },
    swapIcon: {
      color: theme.swapIcon,
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
      color: theme.rateText,
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
      color: theme.statusText,
      fontWeight: '700',
      fontSize: 12,
    },
    keypad: {
      backgroundColor: theme.keypadBackground,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.keypadBorder,
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
      backgroundColor: theme.keyBackground,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 5,
    },
    keyGhost: {
      backgroundColor: theme.keyGhost,
    },
    keyBackspace: {
      backgroundColor: theme.keyBackspace,
    },
    keyPressed: {
      transform: [{ scale: 0.96 }],
      backgroundColor: theme.keyPressed,
      shadowOpacity: 0.04,
    },
    keyPressedBackspace: {
      backgroundColor: theme.keyPressedBackspace,
      opacity: 0.9,
    },
    keyLabel: {
      color: theme.keyLabel,
      fontSize: 22,
      fontWeight: '500',
    },
    keyLabelInverse: {
      color: theme.keyLabelInverse,
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
      backgroundColor: theme.modalShade,
    },
    modalAvoider: {
      width: '100%',
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.modalCard,
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
      color: theme.modalTitle,
      fontSize: 18,
      fontWeight: '700',
    },
    searchInput: {
      backgroundColor: theme.searchBackground,
      color: theme.searchText,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.searchBorder,
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
      color: theme.selectorText,
      fontWeight: '700',
      fontSize: 16,
    },
    currencyNameText: {
      color: theme.currencyName,
      marginTop: 2,
    },
    currencyCheck: {
      color: theme.selectorText,
      fontSize: 16,
      fontWeight: '700',
    },
    rowDivider: {
      height: 1,
      backgroundColor: theme.rowDivider,
    },
    closeButton: {
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 6,
    },
    closeText: {
      color: theme.closeText,
      fontWeight: '700',
      fontSize: 15,
    },
  });

type AppStyles = ReturnType<typeof createStyles>;

type SectionProps = {
  currency: string;
  currencyName?: string;
  symbol: string;
  amount: string;
  active: boolean;
  onFocus: () => void;
  onCurrencyPress: () => void;
  styles: AppStyles;
};

const CurrencySection = ({
  currency,
  currencyName,
  symbol,
  amount,
  active,
  onFocus,
  onCurrencyPress,
  styles,
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
  styles: AppStyles;
  theme: Theme;
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
  styles,
  theme,
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
                placeholderTextColor={theme.placeholder}
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
  styles: AppStyles;
  theme: Theme;
};

const Keypad = ({ onPressKey, onLayout, styles, theme }: KeypadProps) => (
  <View style={styles.keypad} onLayout={onLayout}>
    {keypadLayout.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.keyRow}>
        {row.map((key) => {
          const isBackspace = key === 'backspace';
          const isGhost = key === '.';

          return (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.key,
                isBackspace ? styles.keyBackspace : null,
                isGhost ? styles.keyGhost : null,
                pressed ? styles.keyPressed : null,
                pressed && isBackspace ? styles.keyPressedBackspace : null,
              ]}
              android_ripple={{ color: isBackspace ? theme.keyRippleStrong : theme.keyRipple }}
              onPress={() => onPressKey(key)}
            >
              <Text
                style={[
                  styles.keyLabel,
                  isBackspace ? styles.keyLabelInverse : null,
                ]}
              >
                {isBackspace ? '⌫' : key}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ))}
  </View>
);

function AppContent() {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
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
  const systemScheme = useColorScheme();
  const themeName: ThemeName = systemScheme === 'dark' ? 'dark' : 'light';
  const theme = useMemo(() => themes[themeName], [themeName]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    console.log('[env] EXPO_PUBLIC_API_BASE_URL =', apiBaseUrl);
  }, [apiBaseUrl]);

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
      if (!apiBaseUrl) {
        console.log('[rates] missing EXPO_PUBLIC_API_BASE_URL, using fallback data');
        setCurrencies([...fallbackCurrencies]);
        setCurrencyNames(fallbackNames);
        setRates(deriveRatesFromFallback('USD'));
        setUsingFallback(true);
        setLoading(false);
        return;
      }

      const trimmedBase = apiBaseUrl.replace(/\/$/, '');
      const codesUrl = `${trimmedBase}/codes`;
      const ratesUrl = `${trimmedBase}/rates?base=USD`;

      console.log('[rates] fetching', { codesUrl, ratesUrl });

      try {
        const [codesRes, ratesRes] = await Promise.all([fetch(codesUrl), fetch(ratesUrl)]);

        const codesJson = codesRes.ok ? await codesRes.json() : null;
        const ratesJson = ratesRes.ok ? await ratesRes.json() : null;

        const codesSuccess =
          codesRes.ok && codesJson?.result === 'success' && Array.isArray(codesJson.supported_codes);
        const ratesSuccess = ratesRes.ok && ratesJson?.result === 'success' && ratesJson.conversion_rates;

        console.log('[rates] responses', {
          codesStatus: codesRes.status,
          ratesStatus: ratesRes.status,
          codesSuccess,
          ratesSuccess,
        });

        if (codesSuccess) {
          const pairs = codesJson.supported_codes as [string, string][];
          const codes = pairs.map(([code]) => code).sort();
          const names = Object.fromEntries(pairs);
          setCurrencies(codes);
          setCurrencyNames(names);
        } else {
          console.log('[rates] codes failed, using fallback codes');
          setCurrencies([...fallbackCurrencies]);
          setCurrencyNames(fallbackNames);
        }

        if (ratesSuccess) {
          const incoming = ratesJson.conversion_rates as Record<string, number>;
          const baseCode = (ratesJson.base_code as string) || 'USD';
          setRates({ ...incoming, [baseCode]: 1 });
        } else {
          console.log('[rates] rates failed, using fallback rates');
          setRates(deriveRatesFromFallback('USD'));
        }

        setUsingFallback(!(codesSuccess && ratesSuccess));
      } catch (error) {
        console.log('[rates] fetch failed, using fallback', error);
        setCurrencies([...fallbackCurrencies]);
        setCurrencyNames(fallbackNames);
        setRates(deriveRatesFromFallback('USD'));
        setUsingFallback(true);
      } finally {
        setLoading(false);
      }
    };

    loadSymbolsAndRates();
  }, [apiBaseUrl]);

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
    void Haptics.selectionAsync();

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
                styles={styles}
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
                styles={styles}
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
              styles={styles}
              theme={theme}
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
        styles={styles}
        theme={theme}
        onSearch={setSearchTerm}
        onSelect={selectCurrency}
        onClose={closeModal}
      />

      <StatusBar style={theme.statusBarStyle} />
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
