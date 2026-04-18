// store/interactionSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API = "/api";

// ── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchHCPs = createAsyncThunk(
  "interaction/fetchHCPs",
  async (search = "") => {
    const { data } = await axios.get(`${API}/hcps`, { params: { search } });
    return data;
  },
);

export const submitInteractionForm = createAsyncThunk(
  "interaction/submitForm",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/interactions`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || "Failed to log interaction",
      );
    }
  },
);

export const updateInteraction = createAsyncThunk(
  "interaction/update",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`${API}/interactions/${id}`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to update");
    }
  },
);

export const fetchRecentInteractions = createAsyncThunk(
  "interaction/fetchRecent",
  async (hcpName = "") => {
    const { data } = await axios.get(`${API}/interactions`, {
      params: { hcp_name: hcpName, limit: 20 },
    });
    return data;
  },
);

// ── Initial form state ────────────────────────────────────────────────────────

const today = new Date().toISOString().split("T")[0];
const nowTime = new Date().toTimeString().slice(0, 5);

const emptyForm = {
  hcp_name: "",
  interaction_type: "Meeting",
  interaction_date: today,
  interaction_time: nowTime,
  attendees: "",
  topics_discussed: "",
  materials_shared: [],
  samples_distributed: [],
  sentiment: "neutral",
  outcomes: "",
  follow_up_actions: "",
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const interactionSlice = createSlice({
  name: "interaction",
  initialState: {
    form: { ...emptyForm },
    hcps: [],
    recentInteractions: [],
    savedInteraction: null,
    aiSuggestedFollowups: [],
    status: "idle", // idle | loading | succeeded | failed
    error: null,
    successMessage: null,
  },
  reducers: {
    updateField(state, { payload: { field, value } }) {
      state.form[field] = value;
    },
    setSentiment(state, { payload }) {
      state.form.sentiment = payload;
    },
    addMaterial(state, { payload }) {
      if (payload && !state.form.materials_shared.includes(payload)) {
        state.form.materials_shared.push(payload);
      }
    },
    removeMaterial(state, { payload }) {
      state.form.materials_shared = state.form.materials_shared.filter(
        (m) => m !== payload,
      );
    },
    addSample(state, { payload }) {
      if (payload && !state.form.samples_distributed.includes(payload)) {
        state.form.samples_distributed.push(payload);
      }
    },
    removeSample(state, { payload }) {
      state.form.samples_distributed = state.form.samples_distributed.filter(
        (s) => s !== payload,
      );
    },
    mergeExtractedData(state, { payload }) {
      // Merge AI-extracted data into form fields
      Object.keys(payload).forEach((key) => {
        if (key in state.form && payload[key]) {
          state.form[key] = payload[key];
        }
      });
    },
    setAiFollowups(state, { payload }) {
      state.aiSuggestedFollowups = payload;
    },
    resetForm(state) {
      state.form = { ...emptyForm };
      state.savedInteraction = null;
      state.aiSuggestedFollowups = [];
      state.successMessage = null;
      state.error = null;
    },
    clearMessages(state) {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchHCPs
      .addCase(fetchHCPs.fulfilled, (state, { payload }) => {
        state.hcps = payload;
      })

      // submitInteractionForm
      .addCase(submitInteractionForm.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(submitInteractionForm.fulfilled, (state, { payload }) => {
        state.status = "succeeded";
        state.savedInteraction = payload;
        state.successMessage = `Interaction logged successfully! (ID: ${payload.id})`;
        state.form = { ...emptyForm };
      })
      .addCase(submitInteractionForm.rejected, (state, { payload }) => {
        state.status = "failed";
        state.error = payload;
      })

      // fetchRecentInteractions
      .addCase(fetchRecentInteractions.fulfilled, (state, { payload }) => {
        state.recentInteractions = payload;
      });
  },
});

export const {
  updateField,
  setSentiment,
  addMaterial,
  removeMaterial,
  addSample,
  removeSample,
  mergeExtractedData,
  setAiFollowups,
  resetForm,
  clearMessages,
} = interactionSlice.actions;

export default interactionSlice.reducer;
