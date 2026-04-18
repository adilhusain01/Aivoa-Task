// store/chatSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

const API = '/api'

// ── Async Thunk ───────────────────────────────────────────────────────────────

export const sendChatMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ message, formContext }, { getState, rejectWithValue }) => {
    const { chat } = getState()
    try {
      const { data } = await axios.post(`${API}/chat`, {
        session_id: chat.sessionId,
        message,
        form_context: formContext || null,
      })
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Agent unavailable')
    }
  }
)

// ── Slice ─────────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    sessionId: uuidv4(),
    messages: [
      {
        id: uuidv4(),
        role: 'assistant',
        content: 'Hello! I\'m your AI assistant. Describe your HCP interaction and I\'ll log it for you — e.g. "Met Dr. Sharma at AIIMS, discussed OncoBoost Phase III data, she was very positive and asked for more samples."',
        timestamp: new Date().toISOString(),
      }
    ],
    isTyping: false,
    lastExtractedData: null,
    lastInteractionId: null,
    lastSuggestedFollowups: [],
    error: null,
  },
  reducers: {
    addUserMessage(state, { payload }) {
      state.messages.push({
        id: uuidv4(),
        role: 'user',
        content: payload,
        timestamp: new Date().toISOString(),
      })
    },
    resetSession(state) {
      state.sessionId = uuidv4()
      state.messages = [{
        id: uuidv4(),
        role: 'assistant',
        content: 'New session started. How can I help you log an HCP interaction?',
        timestamp: new Date().toISOString(),
      }]
      state.lastExtractedData = null
      state.lastInteractionId = null
      state.lastSuggestedFollowups = []
    },
    clearChatError(state) {
      state.error = null
    },
  },
  extraReducers: builder => {
    builder
      .addCase(sendChatMessage.pending, state => {
        state.isTyping = true
        state.error = null
      })
      .addCase(sendChatMessage.fulfilled, (state, { payload }) => {
        state.isTyping = false
        state.messages.push({
          id: uuidv4(),
          role: 'assistant',
          content: payload.reply,
          timestamp: new Date().toISOString(),
          toolUsed: payload.tool_used,
          interactionId: payload.interaction_id,
        })
        if (payload.extracted_data) state.lastExtractedData = payload.extracted_data
        if (payload.interaction_id) state.lastInteractionId = payload.interaction_id
        if (payload.suggested_followups?.length) {
          state.lastSuggestedFollowups = payload.suggested_followups
        }
      })
      .addCase(sendChatMessage.rejected, (state, { payload }) => {
        state.isTyping = false
        state.error = payload
        state.messages.push({
          id: uuidv4(),
          role: 'assistant',
          content: '⚠️ Sorry, I couldn\'t process that. Please try again.',
          timestamp: new Date().toISOString(),
          isError: true,
        })
      })
  },
})

export const { addUserMessage, resetSession, clearChatError } = chatSlice.actions
export default chatSlice.reducer
