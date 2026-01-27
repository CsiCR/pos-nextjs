import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useSettings() {
    const { data, error, isLoading } = useSWR('/api/settings', fetcher, {
        refreshInterval: 60000, // Refresh every minute
        revalidateOnFocus: false
    });

    return {
        settings: data || { useDecimals: true },
        isLoading,
        isError: error
    };
}
