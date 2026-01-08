import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

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

const currencyFlags: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  CAD: '🇨🇦',
  AUD: '🇦🇺',
  CHF: '🇨🇭',
};

const sanitizeNumber = (value: string) => value.replace(/[^0-9.,]/g, '');
const parseNumber = (value: string) => Number(value.replace(',', '.'));
const formatAmount = (value: number) =>
  Number.isFinite(value) ? value.toFixed(2) : '0.00';

const deriveRatesFromFallback = (base: string) => {
  if (!baseRates[base as keyof typeof baseRates]) return baseRates;
  const usdPerBase = 1 / baseRates[base as keyof typeof baseRates];
  const entries = Object.entries(baseRates).map(([code, rate]) => [
    code,
    usdPerBase * rate,
  ]);
  return Object.fromEntries(entries) as Record<string, number>;
};

type Target = 'from' | 'to';

export default function App() {
  const apiKey = process.env.EXPO_PUBLIC_EXCHANGERATE_API_KEY;
  const [currencies, setCurrencies] = useState<string[]>([...fallbackCurrencies]);
  const [currencyNames, setCurrencyNames] = useState<Record<string, string>>(fallbackNames);
  const [rates, setRates] = useState<Record<string, number>>(deriveRatesFromFallback('USD'));
  const [fromCurrency, setFromCurrency] = useState<string>('EUR');
  const [toCurrency, setToCurrency] = useState<string>('USD');
  const [amountFrom, setAmountFrom] = useState('100');
  const [amountTo, setAmountTo] = useState('0.00');
  const [activeInput, setActiveInput] = useState<Target>('from');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState<Target>('from');
  const [usingFallback, setUsingFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const statusColor = useMemo(() => {
    if (loading) return '#f59e0b';
    return usingFallback ? '#f97316' : '#22d3ee';
  }, [loading, usingFallback]);

  const rate = useMemo(() => {
    if (!rates[fromCurrency] || !rates[toCurrency]) return 1;
    return rates[toCurrency] / rates[fromCurrency];
  }, [fromCurrency, toCurrency, rates]);

  useEffect(() => {
    console.log('[API] init fetch', { hasApiKey: Boolean(apiKey) });
    const loadSymbolsAndRates = async () => {
      setLoading(true);
      if (!apiKey) {
        setCurrencies([...fallbackCurrencies]);
        setCurrencyNames(fallbackNames);
        setRates(deriveRatesFromFallback('USD'));
        setUsingFallback(true);
        setLoading(false);
        console.log('[API] missing api key, fallback');
        return;
      }

      const codesUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/codes`;
      const ratesUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;

      try {
        const [codesRes, ratesRes] = await Promise.all([fetch(codesUrl), fetch(ratesUrl)]);
        console.log('[API] responses', { codesStatus: codesRes.status, ratesStatus: ratesRes.status });

        const codesJson = codesRes.ok ? await codesRes.json() : null;
        const ratesJson = ratesRes.ok ? await ratesRes.json() : null;
        console.log('[API] codes json', codesJson);
        console.log('[API] rates json', ratesJson);

        const codesSuccess = codesJson?.result === 'success' && Array.isArray(codesJson.supported_codes);
        const ratesSuccess = ratesJson?.result === 'success' && ratesJson.conversion_rates;
        console.log('[API] parsed', { codesSuccess, ratesSuccess });

        if (codesSuccess) {
          const pairs = codesJson.supported_codes as [string, string][];
          const codes = pairs.map(([code]) => code).sort();
          const names = Object.fromEntries(pairs);
          setCurrencies(codes);
          setCurrencyNames(names);
          console.log('[API] codes loaded', codes.length);
        } else {
          console.log('Failed to load currency codes, using fallback.', codesJson);
          setCurrencies([...fallbackCurrencies]);
          setCurrencyNames(fallbackNames);
        }

        if (ratesSuccess) {
          const incoming = ratesJson.conversion_rates as Record<string, number>;
          const baseCode = (ratesJson.base_code as string) || 'USD';
          setRates({ ...incoming, [baseCode]: 1 });
          console.log('[API] rates loaded', Object.keys(ratesJson.conversion_rates || {}).length);
        } else {
          setRates(deriveRatesFromFallback('USD'));
          console.log('[API] rates fallback', ratesJson);
        }

        setUsingFallback(!(codesSuccess && ratesSuccess));
      } catch (error) {
        setCurrencies([...fallbackCurrencies]);
        setCurrencyNames(fallbackNames);
        setRates(deriveRatesFromFallback('USD'));
        setUsingFallback(true);
        console.log('[API] error, fallback', error);
      } finally {
        setLoading(false);
        console.log('[API] fetch done');
      }
    };

    loadSymbolsAndRates();
  }, [apiKey]);

  useEffect(() => {
    console.log('[STATE] rate', rate, 'from', fromCurrency, 'to', toCurrency);
  }, [rate, fromCurrency, toCurrency]);

  useEffect(() => {
    console.log('[STATE] currencies count', currencies.length);
  }, [currencies]);

  useEffect(() => {
    console.log('[STATE] rates count', Object.keys(rates || {}).length);
  }, [rates]);

  useEffect(() => {
    if (activeInput === 'from') {
      const parsed = parseNumber(amountFrom);
      setAmountTo(formatAmount(parsed * rate));
    } else {
      const parsed = parseNumber(amountTo);
      setAmountFrom(formatAmount(parsed / rate));
    }
  }, [rate, activeInput, amountFrom, amountTo, fromCurrency, toCurrency]);

  const handleChangeFrom = (value: string) => {
    const clean = sanitizeNumber(value);
    setActiveInput('from');
    setAmountFrom(clean);
    const parsed = parseNumber(clean);
    setAmountTo(formatAmount(parsed * rate));
    console.log('[INPUT] from changed', clean);
  };

  const handleChangeTo = (value: string) => {
    const clean = sanitizeNumber(value);
    setActiveInput('to');
    setAmountTo(clean);
    const parsed = parseNumber(clean);
    setAmountFrom(formatAmount(parsed / rate));
    console.log('[INPUT] to changed', clean);
  };

  const swap = () => {
    const prevFrom = fromCurrency;
    const prevTo = toCurrency;
    const prevAmountTo = amountTo;
    setFromCurrency(prevTo);
    setToCurrency(prevFrom);
    setAmountFrom(prevAmountTo);
    setActiveInput('from');
    console.log('[ACTION] swap', { from: prevFrom, to: prevTo });
  };

  const openModal = (target: Target) => {
    setModalTarget(target);
    setModalVisible(true);
    setSearchTerm('');
    console.log('[ACTION] open modal', target);
  };

  const closeModal = () => setModalVisible(false);

  const selectCurrency = (code: string) => {
    if (modalTarget === 'from') {
      setFromCurrency(code);
    } else {
      setToCurrency(code);
    }
    setModalVisible(false);
    console.log('[ACTION] select currency', { target: modalTarget, code });
  };

  const filteredCurrencies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return currencies;
    return currencies.filter((code) => {
      const name = currencyNames[code]?.toLowerCase() ?? '';
      return code.toLowerCase().includes(term) || name.includes(term);
    });
  }, [currencies, currencyNames, searchTerm]);

  const renderCurrencyRow = ({ item }: { item: string }) => (
    <Pressable style={styles.currencyRow} onPress={() => selectCurrency(item)}>
      <Text style={styles.rowFlag}>{currencyFlags[item] ?? '🏳️'}</Text>
      <View style={styles.rowTextBlock}>
        <Text style={styles.rowCode}>{item}</Text>
        <Text style={styles.rowName}>{currencyNames[item] ?? '—'}</Text>
      </View>
    </Pressable>
  );

  const SelectedCurrency = ({
    code,
    onPress,
  }: {
    code: string;
    onPress: () => void;
  }) => (
    <Pressable onPress={onPress} style={styles.selectedCurrency}>
      <Text style={styles.badgeFlag}>{currencyFlags[code] ?? '🏳️'}</Text>
      <Text style={styles.badgeText}>{code}</Text>
      <Text style={styles.badgeName}>{currencyNames[code] ?? 'Currency'}</Text>
    </Pressable>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.title}>Currency Converter</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={styles.statusText}>
                    {loading ? 'Mise à jour' : usingFallback ? 'Taux locaux' : 'Taux en direct'}
                  </Text>
                </View>
              </View>

              <View style={styles.split}>
                <View style={[styles.panel, styles.toPanel]}>
                  <View style={styles.panelTop}>
                    <SelectedCurrency code={toCurrency} onPress={() => openModal('to')} />
                  </View>
                  <TextInput
                    value={amountTo}
                    onChangeText={handleChangeTo}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#6b7280"
                  />
                  <Text style={styles.rateLine}>
                    1 {fromCurrency} = {rate.toFixed(4)} {toCurrency}
                  </Text>
                </View>

                <Pressable style={styles.swapButton} onPress={swap}>
                  <Text style={styles.swapText}>⇄</Text>
                </Pressable>

                <View style={[styles.panel, styles.fromPanel]}>
                  <View style={styles.panelTop}>
                    <SelectedCurrency code={fromCurrency} onPress={() => openModal('from')} />
                  </View>
                  <TextInput
                    value={amountFrom}
                    onChangeText={handleChangeFrom}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#6b7280"
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>

        <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
          <TouchableWithoutFeedback onPress={closeModal} accessible={false}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
                  style={styles.modalAvoider}
                >
                  <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Choisir une monnaie</Text>
                    </View>
                    <TextInput
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      placeholder="Rechercher un code ou nom…"
                      placeholderTextColor="#6b7280"
                      style={styles.searchInput}
                      autoFocus
                    />
                    <FlatList
                      data={filteredCurrencies}
                      keyExtractor={(item) => item}
                      renderItem={renderCurrencyRow}
                      ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
                      style={styles.modalList}
                      contentContainerStyle={{ paddingBottom: 20 }}
                      keyboardShouldPersistTaps="handled"
                    />
                    <Pressable style={styles.closeButton} onPress={closeModal}>
                      <Text style={styles.closeText}>Fermer</Text>
                    </Pressable>
                  </View>
                </KeyboardAvoidingView>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: '#0b1222',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 0,
    gap: 16,
  },
  header: {
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  title: {
    color: '#e5e7eb',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  split: {
    flex: 1,
    flexDirection: 'row',
    gap: 0,
    position: 'relative',
    paddingHorizontal: 0,
  },
  panel: {
    flex: 1,
    borderRadius: 18,
    padding: 20,
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  toPanel: {
    backgroundColor: '#111827',
  },
  fromPanel: {
    backgroundColor: '#0f172a',
  },
  panelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  selectedCurrency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 170,
  },
  badgeFlag: {
    fontSize: 16,
  },
  badgeText: {
    color: '#e5e7eb',
    fontWeight: '800',
    fontSize: 14,
  },
  badgeName: {
    color: '#9ca3af',
    fontSize: 12,
    flexShrink: 1,
  },
  input: {
    color: '#f3f4f6',
    fontSize: 32,
    fontWeight: '700',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#0e1528',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  rateLine: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  swapButton: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -26 }, { translateY: -26 }],
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#22d3ee',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22d3ee',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 3,
  },
  swapText: {
    color: '#0b1222',
    fontWeight: '800',
    fontSize: 22,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalAvoider: {
    width: '100%',
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: '80%',
  },
  modalHeader: {
    marginBottom: 12,
  },
  modalTitle: {
    color: '#f3f4f6',
    fontSize: 18,
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: '#111827',
    color: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  modalList: {
    maxHeight: '70%',
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowFlag: {
    fontSize: 18,
    width: 30,
  },
  rowTextBlock: {
    flex: 1,
  },
  rowCode: {
    color: '#e5e7eb',
    fontWeight: '700',
    fontSize: 15,
  },
  rowName: {
    color: '#9ca3af',
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#1f2937',
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    marginTop: 8,
    marginBottom: 12,
  },
  closeText: {
    color: '#e5e7eb',
    fontWeight: '700',
  },
});
