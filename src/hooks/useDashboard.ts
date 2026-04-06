import { useQuery } from '@tanstack/react-query';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { formatCompactCurrency } from '../utils/format';

export const useDashboard = () => {
  const { ownerId, ownerLoading } = useOwner();

  return useQuery({
    queryKey: ['dashboard', ownerId],
    enabled: !!ownerId && !ownerLoading,
    queryFn: async () => {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
      const todayStr = today.toISOString().split('T')[0];
      const thirtyDaysLater = new Date(today);
      thirtyDaysLater.setDate(today.getDate() + 30);
      const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const last6: { label: string; short: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        last6.push({
          label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
          short: d.toLocaleString('default', { month: 'short' }),
        });
      }

      const [ownerSnap, bedsSnap, leasesSnap, paymentsSnap] = await Promise.all([
        getDoc(doc(db, 'owners', ownerId!)),
        getDocs(query(collection(db, 'beds'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'leases'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'payments'), where('owner_id', '==', ownerId))),
      ]);

      const ownerData = ownerSnap.data() as { currency?: string };
      const currency = ownerData?.currency || 'USD';

      const beds = bedsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as { id: string; status: string }[];

      const totalBeds = beds.length;
      const vacantBeds = beds.filter(b => b.status === 'Vacant').length;

      const allLeases = leasesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as {
        id: string;
        status: string;
        end_date?: string;
        rent_amount: number;
      }[];

      const activeLeases = allLeases.filter(l => l.status === 'Active');
      const activeLeaseRent = activeLeases.reduce((acc, l) => acc + (Number(l.rent_amount) || 0), 0);

      const expiringCount = allLeases.filter(l =>
        l.status === 'Active' && l.end_date &&
        l.end_date >= todayStr && l.end_date <= thirtyDaysLaterStr
      ).length;

      let monthlyRevenue = 0;
      let annualRevenue = 0;
      let overdueAmount = 0;
      const revenueByMonth: Record<string, number> = {};
      last6.forEach(m => { revenueByMonth[m.label] = 0; });

      const payments = paymentsSnap.docs.map(d => d.data()) as {
        amount: number;
        status: string;
        month_for: string;
        payment_date: string;
      }[];

      payments.forEach(p => {
        const amount = Number(p.amount);
        if (p.status === 'Paid' && p.month_for === currentMonth) monthlyRevenue += amount;
        if (p.status === 'Paid' && p.payment_date >= yearStart && p.payment_date <= yearEnd) annualRevenue += amount;
        if (p.status === 'Pending' || p.status === 'Partial') overdueAmount += amount;
        if (p.status === 'Paid' && revenueByMonth[p.month_for] !== undefined) {
          revenueByMonth[p.month_for] += amount;
        }
      });

      const revenueChart = last6.map(m => ({ month: m.short, revenue: revenueByMonth[m.label] || 0 }));
      const stats = {
        monthlyRevenue: formatCompactCurrency(monthlyRevenue, currency),
        activeLeaseRent: formatCompactCurrency(activeLeaseRent, currency),
        overdueAmount: formatCompactCurrency(overdueAmount, currency),
        leaseExpirations: String(expiringCount),
        annualRevenue: formatCompactCurrency(annualRevenue, currency),
        totalBeds,
        vacantBeds,
        currency,
      };

      return { stats, revenueChart };
    },
  });
};;
