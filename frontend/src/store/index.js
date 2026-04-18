// store/index.js
import { configureStore } from '@reduxjs/toolkit'
import interactionReducer from './interactionSlice'
import chatReducer from './chatSlice'

const store = configureStore({
  reducer: {
    interaction: interactionReducer,
    chat: chatReducer,
  },
  middleware: getDefault => getDefault({ serializableCheck: false }),
})

export default store
