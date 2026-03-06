import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pvlrtbskgavqiudvalij.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bHJ0YnNrZ2F2cWl1ZHZhbGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODc2MzAsImV4cCI6MjA4ODM2MzYzMH0.SBDj_gILzGx-NIzEu08FRIDHQUsob0rdIHXgrSoYUV4'

export const supabase = createClient(supabaseUrl, supabaseKey)