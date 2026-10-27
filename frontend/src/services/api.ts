import {
  Cafeteria, FoodItem, InventoryItem, PredictionRequest, PredictionResponse,
  PredictionHistoryItem, WasteAnalytics, RecipientOrganization, SurplusBatch,
  SurplusMatchResponse, RedistributionTransaction, PipelineExecution,
  ModelMetrics, DashboardSummary, NextDayDinerRecommendation, NextDayPrepPlan,
  ProductWastePrepConsumedResponse, ProductWastePrepConsumedItem
} from '../types';

export const API_BASE = ((import.meta as any).env?.VITE_API_URL || '/api').replace(/\/$/, '');

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.detail || errJson.message || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Health
  getHealth: () => request<{ status: string; app_name: string; version: string; mode: string; database: string; ml_engine: string }>('/health'),

  // Dashboard
  getDashboardSummary: (cafeteriaId?: string) => 
    request<DashboardSummary>(`/dashboard/summary${cafeteriaId ? `?cafeteria_id=${cafeteriaId}` : ''}`),

  // Cafeterias & Food Items
  getCafeterias: () => request<Cafeteria[]>('/cafeterias'),
  getFoodItems: () => request<FoodItem[]>('/food-items'),
  createFoodItem: (item: Partial<FoodItem>) => 
    request<FoodItem>('/food-items', { method: 'POST', body: JSON.stringify(item) }),

  // Inventory CRUD
  getInventory: (cafeteriaId?: string, statusFilter?: string, search?: string) => {
    const params = new URLSearchParams();
    if (cafeteriaId) params.append('cafeteria_id', cafeteriaId);
    if (statusFilter) params.append('status_filter', statusFilter);
    if (search) params.append('search', search);
    const qs = params.toString();
    return request<InventoryItem[]>(`/inventory${qs ? `?${qs}` : ''}`);
  },
  createInventoryItem: (item: Partial<InventoryItem>) =>
    request<InventoryItem>('/inventory', { method: 'POST', body: JSON.stringify(item) }),
  updateInventoryItem: (id: number, update: Partial<InventoryItem>) =>
    request<InventoryItem>(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(update) }),
  deleteInventoryItem: (id: number) =>
    request<{ message: string }>(`/inventory/${id}`, { method: 'DELETE' }),

  // Prediction & Next-Day Dinner/Diner Recommender
  predictDemand: (req: PredictionRequest) =>
    request<PredictionResponse>('/predict', { method: 'POST', body: JSON.stringify(req) }),
  getPredictionHistory: () =>
    request<PredictionHistoryItem[]>('/predictions/history'),
  getNextDayDiners: (params?: {
    cafeteria_id?: string;
    target_date?: string;
    weather_condition?: string;
    temperature_c?: number;
    is_holiday?: boolean;
    is_special_event?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.cafeteria_id) qs.append('cafeteria_id', params.cafeteria_id);
    if (params?.target_date) qs.append('target_date', params.target_date);
    if (params?.weather_condition) qs.append('weather_condition', params.weather_condition);
    if (params?.temperature_c !== undefined) qs.append('temperature_c', String(params.temperature_c));
    if (params?.is_holiday !== undefined) qs.append('is_holiday', String(params.is_holiday));
    if (params?.is_special_event !== undefined) qs.append('is_special_event', String(params.is_special_event));
    const qsStr = qs.toString();
    return request<NextDayDinerRecommendation>(`/predict/next-day/diners${qsStr ? `?${qsStr}` : ''}`);
  },
  getNextDayDinnerPlan: (params?: {
    cafeteria_id?: string;
    target_date?: string;
    category?: string;
    weather_condition?: string;
    temperature_c?: number;
    is_holiday?: boolean;
    is_special_event?: boolean;
    safety_buffer_pct?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.cafeteria_id) qs.append('cafeteria_id', params.cafeteria_id);
    if (params?.target_date) qs.append('target_date', params.target_date);
    if (params?.category) qs.append('category', params.category);
    if (params?.weather_condition) qs.append('weather_condition', params.weather_condition);
    if (params?.temperature_c !== undefined) qs.append('temperature_c', String(params.temperature_c));
    if (params?.is_holiday !== undefined) qs.append('is_holiday', String(params.is_holiday));
    if (params?.is_special_event !== undefined) qs.append('is_special_event', String(params.is_special_event));
    if (params?.safety_buffer_pct !== undefined) qs.append('safety_buffer_pct', String(params.safety_buffer_pct));
    const qsStr = qs.toString();
    return request<NextDayPrepPlan>(`/predict/next-day/dinners${qsStr ? `?${qsStr}` : ''}`);
  },

  // Waste & Product Food Flow Audit
  getWasteAnalytics: (cafeteriaId?: string) =>
    request<WasteAnalytics>(`/waste/analytics${cafeteriaId ? `?cafeteria_id=${cafeteriaId}` : ''}`),
  getProductWastePrepConsumed: (params?: {
    cafeteria_id?: string;
    search?: string;
    category?: string;
    sort_by?: string;
    sort_order?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.cafeteria_id) qs.append('cafeteria_id', params.cafeteria_id);
    if (params?.search) qs.append('search', params.search);
    if (params?.category) qs.append('category', params.category);
    if (params?.sort_by) qs.append('sort_by', params.sort_by);
    if (params?.sort_order) qs.append('sort_order', params.sort_order);
    const qsStr = qs.toString();
    return request<ProductWastePrepConsumedResponse>(`/analytics/product-waste-prep-consumed${qsStr ? `?${qsStr}` : ''}`);
  },
  getSingleProductFlow: (productIdOrName: string, cafeteriaId?: string) =>
    request<ProductWastePrepConsumedItem>(
      `/analytics/product-waste-prep-consumed/${encodeURIComponent(productIdOrName)}${cafeteriaId ? `?cafeteria_id=${cafeteriaId}` : ''}`
    ),
  logWasteRecord: (record: {
    cafeteria_id: string;
    food_item_id: string;
    record_date: string;
    wasted_qty: number;
    unit: string;
    waste_reason: string;
    unit_cost?: number;
    is_preventable?: boolean;
    notes?: string;
  }) => request('/waste', { method: 'POST', body: JSON.stringify(record) }),

  // Redistribution
  getRecipients: () => request<RecipientOrganization[]>('/redistribution/recipients'),
  createRecipient: (recip: Partial<RecipientOrganization>) =>
    request<RecipientOrganization>('/redistribution/recipients', { method: 'POST', body: JSON.stringify(recip) }),
  getSurplusBatches: (cafeteriaId?: string) =>
    request<SurplusBatch[]>(`/redistribution/surplus${cafeteriaId ? `?cafeteria_id=${cafeteriaId}` : ''}`),
  getSurplusMatch: (inventoryItemId: number) =>
    request<SurplusMatchResponse>(`/redistribution/match/${inventoryItemId}`),
  allocateSurplus: (data: {
    inventory_item_id: number;
    recipient_id: string;
    quantity: number;
    scheduled_pickup?: string;
    notes?: string;
  }) => request<RedistributionTransaction>('/redistribution/allocate', { method: 'POST', body: JSON.stringify(data) }),
  getRedistributionHistory: () =>
    request<RedistributionTransaction[]>('/redistribution/history'),
  updateTransactionStatus: (id: number, status: string) =>
    request(`/redistribution/transactions/${id}/status?new_status=${status}`, { method: 'PUT' }),

  // Pipeline
  uploadCsv: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/pipeline/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Upload failed');
    }
    return response.json();
  },
  getPipelineExecutions: () => request<PipelineExecution[]>('/pipeline/executions'),
  downloadTemplateUrl: `${API_BASE}/pipeline/template`,

  // ML Retraining
  getModelMetrics: () => request<ModelMetrics>('/ml/metrics'),
  triggerRetraining: (data: { target_algorithm?: string; min_improvement_pct?: number; force_promote?: boolean }) =>
    request<{
      status: string;
      candidate_version: string;
      active_version: string;
      candidate_mae: number;
      candidate_rmse: number;
      active_mae: number;
      active_rmse: number;
      samples_used: number;
      message: string;
    }>('/ml/retrain', { method: 'POST', body: JSON.stringify(data) }),

  // Settings
  getSettings: () => request<Record<string, { value: string; description?: string }>>('/settings'),
  updateSettings: (settings: Record<string, string>) =>
    request('/settings', { method: 'PUT', body: JSON.stringify({ settings }) }),
  resetDemoData: () => request<{ message: string }>('/settings/reset-demo', { method: 'POST' }),

  // Export Reports
  getExportUrl: (reportType: string, formatType: string = 'csv', cafeteriaId?: string) =>
    `${API_BASE}/reports/export?report_type=${reportType}&format_type=${formatType}${cafeteriaId ? `&cafeteria_id=${cafeteriaId}` : ''}`,
};
