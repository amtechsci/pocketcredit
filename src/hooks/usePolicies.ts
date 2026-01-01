import { useState, useEffect } from 'react';
import { fetchAllPolicies, fetchPolicyBySlug, Policy } from '../services/policyService';

/**
 * Hook to fetch all active policies
 */
export const usePolicies = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAllPolicies();
        setPolicies(data);
      } catch (err) {
        setError('Failed to load policies');
        console.error('Error loading policies:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPolicies();
  }, []);

  return { policies, loading, error };
};

/**
 * Hook to fetch a single policy by slug
 */
export const usePolicy = (slug: string) => {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPolicyBySlug(slug);
        setPolicy(data);
        if (!data) {
          setError(`Policy '${slug}' not found`);
        }
      } catch (err) {
        setError('Failed to load policy');
        console.error(`Error loading policy '${slug}':`, err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      loadPolicy();
    }
  }, [slug]);

  return { policy, loading, error };
};

