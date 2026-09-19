import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { createClient } from '@supabase/supabase-js'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function MapView() {
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const stopsRef = useRef([])
  const markersRef = useRef([])

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [24.5, -29.5],
      zoom: 5,
    })
    mapRef.current = map

    map.on('load', async () => {
      const { data, error } = await supabase
        .from('stops')
        .select('name, longitude, latitude, story, attractions')
        .order('id', { ascending: true })

      if (error) {
        console.error('Supabase error:', error)
        return
      }

      const stops = data.map((row) => ({
        name: row.name,
        coord: [row.longitude, row.latitude],
        story: row.story,
        attractions: row.attractions,
      }))
      stopsRef.current = stops

      // faint full route
      map.addSource('route-full', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: stops.map((s) => s.coord) } },
      })
      map.addLayer({
        id: 'route-full-line', type: 'line', source: 'route-full',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#C9D6DF', 'line-width': 3 },
      })

      // gold progress line (drawn during animation)
      map.addSource('route-progress', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      })
      map.addLayer({
        id: 'route-progress-line', type: 'line', source: 'route-progress',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#E9B44C', 'line-width': 5 },
      })

      // markers
      stops.forEach((s) => {
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
      `<strong style="color:#065A82;font-size:15px">${s.name}</strong>
      <p style="margin:6px 0;font-size:13px">${s.story}</p>
      <strong style="font-size:12px;color:#1C7293">Don't miss:</strong>
      <ul style="margin:4px 0 0;padding-left:18px;font-size:12px">
      ${(s.attractions || '').split(';').map(a => `<li>${a.trim()}</li>`).join('')}
   </ul>`
)

        const marker = new mapboxgl.Marker({ color: '#065A82' })
          .setLngLat(s.coord)
          .setPopup(popup)
          .addTo(map)
        markersRef.current.push(marker)
      })
    })

    return () => map.remove()
  }, [])

  async function playJourney() {
    const map = mapRef.current
    const stops = stopsRef.current
    const markers = markersRef.current
    if (!map || stops.length === 0) return

    map.getSource('route-progress').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } })
    map.flyTo({ center: stops[0].coord, zoom: 5.2, pitch: 0, duration: 1500 })
    await sleep(1800)

    const travelled = []
    for (let i = 0; i < stops.length; i++) {
      travelled.push(stops[i].coord)
      map.getSource('route-progress').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [...travelled] } })
      map.flyTo({ center: stops[i].coord, zoom: 6.5, pitch: 45, duration: 1600, essential: true })
      markers[i].togglePopup()
      await sleep(1900)
      if (i < stops.length - 1) markers[i].togglePopup()
    }
    map.flyTo({ center: [24.5, -29.5], zoom: 5.1, pitch: 0, duration: 2000 })
  }

  return (
    <>
      <button
        onClick={playJourney}
        style={{
          position: 'absolute', top: 15, left: 15, zIndex: 1,
          background: '#065A82', color: '#fff', border: 'none',
          borderRadius: 6, padding: '10px 16px', fontWeight: 'bold', cursor: 'pointer',
        }}
      >
        ▶ Play journey
      </button>
      <div
        ref={mapContainer}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
      />
    </>
  )
}

export default MapView