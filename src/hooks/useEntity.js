import { useCallback, useEffect, useState } from "react";
import { localClient } from "@/api/localStorageClient";

/**
 * Loads an entity collection with loading/error state.
 * @param {Function} loader - async function returning the data array
 * @param {Array} deps - dependency array for refetching
 */
export function useEntityList(loader, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result || []);
    } catch (e) {
      setError(e);
      setData([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
    const handleSync = () => reload();
    window.addEventListener("lifeos:storage-synced", handleSync);
    return () => window.removeEventListener("lifeos:storage-synced", handleSync);
  }, [reload]);

  return { data, loading, error, reload, setData };
}

/**
 * Simplified hook for working with localStorage entities directly
 * @param {string} entityName - Name of the entity (e.g., 'Task', 'Subject')
 * @param {string} sortField - Optional sort field (e.g., '-updated_date')
 * @param {number} limit - Optional limit
 */
export function useLocalStorageEntity(entityName, sortField = null, limit = null) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = localClient.entities[entityName].list(sortField, limit);
      setData(result || []);
    } catch (e) {
      setError(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [entityName, sortField, limit]);

  useEffect(() => {
    reload();
    const handleSync = () => reload();
    window.addEventListener("lifeos:storage-synced", handleSync);
    return () => window.removeEventListener("lifeos:storage-synced", handleSync);
  }, [reload]);

  const create = useCallback(async (entityData) => {
    try {
      const newEntity = localClient.entities[entityName].create(entityData);
      await reload();
      return newEntity;
    } catch (e) {
      setError(e);
      throw e;
    }
  }, [entityName, reload]);

  const update = useCallback(async (id, entityData) => {
    try {
      const updatedEntity = localClient.entities[entityName].update(id, entityData);
      await reload();
      return updatedEntity;
    } catch (e) {
      setError(e);
      throw e;
    }
  }, [entityName, reload]);

  const remove = useCallback(async (id) => {
    try {
      localClient.entities[entityName].delete(id);
      await reload();
    } catch (e) {
      setError(e);
      throw e;
    }
  }, [entityName, reload]);

  return { data, loading, error, reload, setData, create, update, remove };
}