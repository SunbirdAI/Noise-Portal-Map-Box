export const DEFAULT_API_BASE_URL = 'https://noise-sensors-dashboard.herokuapp.com';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? DEFAULT_API_BASE_URL;

export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '';
