//@ts-ignore
/* eslint-disable */
declare global {
    interface Window {
        mapboxgl: any;
        MapboxDirections: any;
        MapboxGeocoder: any;
    }
}

interface MarkerOptions {
    color?: string;
    draggable?: boolean;
    element?: HTMLElement;
    popup?: string;
    offset?: any;
    scale?: number;
    rotation?: number;
}

interface PopupOptions {
    closeButton?: boolean;
    closeOnClick?: boolean;
    closeOnMove?: boolean;
    maxWidth?: string;
    offset?: any;
    className?: string;
    anchor?: string;
}

interface ControlOptions {
    navigation?: boolean;
    scale?: boolean;
    fullscreen?: boolean;
    geolocate?: boolean;
    position?: string;
}

interface RouteOptions {
    profile?: string;
    alternatives?: boolean;
    steps?: boolean;
    geometries?: string;
    annotations?: string;
    overview?: string;
}

interface Layer {
    sourceId: string;
    layerId: string;
    outlineLayerId?: string;
}

interface TransformRequestOptions {
    url: string;
    headers?: Record<string, string>;
    credentials?: string;
}

export class MapboxToolkit {
    private accessToken: string;
    private containerId: string;
    public proxyBaseUrl: string = 'https://openai.getcreatr.xyz/v1/mapbox/proxy';
    private apiKey: string;
    public map: any;
    private markers: any[];
    private routes: Layer[];
    private directionsControl: any;
    private isochroneLayers: Layer[];

    constructor(containerId = 'map',) {
        this.accessToken = "pk_dummy";
        this.containerId = containerId;
        this.map = null;
        this.markers = [];
        this.routes = [];
        this.directionsControl = null;
        this.isochroneLayers = [];
        this.apiKey = "6827620bf50fcf0013766791";
    }

    /**
     * Load Mapbox GL JS and CSS resources
     */
    loadMapboxResources(): Promise<void> {
        if (!document.getElementById('mapbox-css')) {
            const css = document.createElement('link');
            css.id = 'mapbox-css';
            css.rel = 'stylesheet';
            css.href = 'https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.css';
            document.head.appendChild(css);
        }

        if (typeof window.mapboxgl === 'undefined') {
            return new Promise<void>((resolve, reject) => {
                const script = document.createElement('script');
                script.id = 'mapbox-gl-js';
                script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.js';
                script.onload = () => {
                    window.mapboxgl.accessToken = this.accessToken;
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        } else {
            window.mapboxgl.accessToken = this.accessToken;
            return Promise.resolve();
        }
    }

    /**
     * Initialize the map
     */
    async initializeMap(options: any = {}): Promise<any> {
        await this.loadMapboxResources();

        // Default transformRequest option
        const defaultTransformRequest = (url: string, resourceType?: string): TransformRequestOptions => {
            // Check if this is a Mapbox request
            if (url.includes('api.mapbox.com') ||
                url.includes('mapbox://') ||
                resourceType === 'Style' ||
                resourceType === 'Sprite' ||
                resourceType === 'Tile' ||
                resourceType === 'Glyphs') {

                // Handle mapbox:// protocol URLs
                if (url.includes('mapbox://')) {
                    if (url.includes('mapbox://styles')) {
                        const styleId = url.replace('mapbox://styles/', '');
                        const proxiedUrl = `${this.proxyBaseUrl}/styles/v1/${styleId}?access_token=${this.accessToken}`;

                        return {
                            url: proxiedUrl,
                            headers: { 'x-api-key': this.apiKey }
                        };
                    }
                }

                // Regular HTTP URLs
                if (url.includes('api.mapbox.com')) {
                    const proxiedUrl = url.replace('https://api.mapbox.com', this.proxyBaseUrl);

                    return {
                        url: proxiedUrl,
                        headers: { 'x-api-key': this.apiKey }
                    };
                }
            }

            // Return unchanged for non-Mapbox resources
            return { url };
        };

        const defaultOptions = {
            container: this.containerId,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-74.5, 40],
            zoom: 9,
            interactive: true,
            transformRequest: defaultTransformRequest
        };

        const mapOptions = { ...defaultOptions, ...options };

        return new Promise<any>((resolve) => {
            this.map = new window.mapboxgl.Map(mapOptions);
            this.map.on('load', () => {
                resolve(this.map);
            });

            // Add error handler
            this.map.on('error', (err: any) => {
                console.error('Mapbox error:', err);
            });
        });
    }

    /**
     * Creates a proxied URL for Mapbox API requests
     */
    private createProxiedUrl(originalUrl: string): string {
        // If URL is already proxied, return as is
        if (originalUrl.includes(this.proxyBaseUrl)) {
            return originalUrl;
        }

        // Replace the Mapbox API base URL with our proxy URL
        let proxiedUrl = originalUrl.replace(
            'https://api.mapbox.com',
            this.proxyBaseUrl
        );

        // Ensure access token is included
        if (!proxiedUrl.includes('access_token')) {
            const separator = proxiedUrl.includes('?') ? '&' : '?';
            proxiedUrl += `${separator}access_token=${this.accessToken}`;
        }

        return proxiedUrl;
    }

    /**
     * Make a request through the proxy
     */
    private async proxyRequest(url: string, options: RequestInit = {}): Promise<any> {
        const proxiedUrl = this.createProxiedUrl(url);

        // Add API key header
        const headers = {
            ...options.headers,
            'x-api-key': this.apiKey
        };

        try {
            const response = await fetch(proxiedUrl, {
                ...options,
                headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Proxy request failed:', error);
            throw error;
        }
    }

    /**
     * Set map style
     */
    setMapStyle(styleUrl: string): void {
        if (!this.map) throw new Error('Map not initialized');
        this.map.setStyle(styleUrl);
    }

    /**
     * Get available Mapbox styles
     */
    getMapboxStyles(): Record<string, string> {
        return {
            streets: 'mapbox://styles/mapbox/streets-v12',
            outdoors: 'mapbox://styles/mapbox/outdoors-v12',
            light: 'mapbox://styles/mapbox/light-v11',
            dark: 'mapbox://styles/mapbox/dark-v11',
            satellite: 'mapbox://styles/mapbox/satellite-v9',
            satelliteStreets: 'mapbox://styles/mapbox/satellite-streets-v12'
        };
    }

    /**
     * Add a marker to the map
     */
    addMarker(lngLat: number[], options: MarkerOptions = {}): any {
        if (!this.map) throw new Error('Map not initialized');

        const defaults = {
            color: '#3FB1CE',
            draggable: false,
        };

        const opts = { ...defaults, ...options };
        const element = opts.element;
        delete opts.element;
        delete opts.popup;

        const marker = new window.mapboxgl.Marker(opts)
            .setLngLat(lngLat)
            .addTo(this.map);

        if (options.popup) {
            const popup = new window.mapboxgl.Popup({ offset: 25 })
                .setHTML(options.popup);
            marker.setPopup(popup);
        }

        this.markers.push(marker);
        return marker;
    }

    /**
     * Remove a marker from the map
     */
    removeMarker(marker: any): void {
        if (!marker) return;
        marker.remove();
        this.markers = this.markers.filter(m => m !== marker);
    }

    /**
     * Clear all markers from the map
     */
    clearMarkers(): void {
        this.markers.forEach(m => m.remove());
        this.markers = [];
    }

    /**
     * Add a popup to the map
     */
    addPopup(lngLat: number[], content: string, options: PopupOptions = {}): any {
        if (!this.map) throw new Error('Map not initialized');

        return new window.mapboxgl.Popup(options)
            .setLngLat(lngLat)
            .setHTML(content)
            .addTo(this.map);
    }

    /**
     * Add controls to the map
     */
    addControls(options: ControlOptions = {}): void {
        if (!this.map) throw new Error('Map not initialized');

        const defaults = {
            navigation: true,
            scale: true,
            fullscreen: false,
            geolocate: false,
            position: 'top-right'
        };

        const opts = { ...defaults, ...options };

        if (opts.navigation) {
            this.map.addControl(new window.mapboxgl.NavigationControl(), opts.position);
        }

        if (opts.scale) {
            this.map.addControl(new window.mapboxgl.ScaleControl(), 'bottom-left');
        }

        if (opts.fullscreen) {
            this.map.addControl(new window.mapboxgl.FullscreenControl(), opts.position);
        }

        if (opts.geolocate) {
            this.map.addControl(
                new window.mapboxgl.GeolocateControl({
                    positionOptions: { enableHighAccuracy: true },
                    trackUserLocation: true,
                    showUserHeading: true
                }),
                opts.position
            );
        }
    }

    /**
     * Load Mapbox Directions plugin
     */
    loadMapboxServices(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (typeof window.MapboxDirections !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.id = 'mapbox-services-js';
            script.src = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.1.1/mapbox-gl-directions.js';
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);

            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.1.1/mapbox-gl-directions.css';
            document.head.appendChild(css);
        });
    }

    /**
     * Load Mapbox Geocoder plugin
     */
    loadMapboxGeocoder(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (typeof window.MapboxGeocoder !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.id = 'mapbox-geocoder-js';
            script.src = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js';
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);

            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.css';
            document.head.appendChild(css);
        });
    }

    /**
     * Search for locations using Mapbox Search API
     */
    async searchSuggest(query: string, options: any = {}): Promise<any> {
        if (!query) throw new Error('Search query required');

        const defaults = {
            limit: 5,
            types: ['address', 'poi', 'place']
        };

        const opts = { ...defaults, ...options };
        let url = `${this.proxyBaseUrl}/search/searchbox/v1/suggest`;
        let params = new URLSearchParams({
            access_token: this.accessToken,
            q: query,
            limit: opts.limit.toString(),
            session_token: "5f256ef2-7702-487b-8bd9-0a2e57455b68"
        });

        if (opts.types?.length) params.append('types', opts.types.join(','));
        if (opts.proximity) params.append('proximity', opts.proximity.join(','));
        if (opts.language) params.append('language', opts.language);
        if (opts.country) params.append('country', opts.country);
        if (opts.bbox) params.append('bbox', opts.bbox.join(','));
        if (opts.sessionToken) params.append('session_token', opts.sessionToken);

        url = `${url}?${params.toString()}`;

        try {
            return await this.proxyRequest(url);
        } catch (error) {
            console.error('Search suggestion error:', error);
            throw error;
        }
    }

    /**
     * Retrieve search result details
     */
    async searchRetrieve(suggestionId: string, options: any = {}): Promise<any> {
        if (!suggestionId) throw new Error('Suggestion ID required');

        let url = `${this.proxyBaseUrl}/search/searchbox/v1/retrieve/${suggestionId}`;
        let params = new URLSearchParams({
            access_token: this.accessToken,
            session_token: "5f256ef2-7702-487b-8bd9-0a2e57455b68"
        });

        if (options.sessionToken) params.append('session_token', options.sessionToken);
        url = `${url}?${params.toString()}`;

        try {
            const data = await this.proxyRequest(url);

            if (this.map && data.features?.length && data.features[0].geometry) {
                const feature = data.features[0];
                const coordinates = feature.geometry.coordinates;
                // You can add zoom to location here if needed
            }

            return data;
        } catch (error) {
            console.error('Retrieve error:', error);
            throw error;
        }
    }

    /**
     * Forward geocode a place name to coordinates
     */
    async forwardGeocode(placeName: string, options: any = {}): Promise<any> {
        if (!placeName) throw new Error('Place name required');

        const defaults = { limit: 1, types: 'address,poi,place' };
        const opts = { ...defaults, ...options };

        let url = `${this.proxyBaseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(placeName)}.json`;
        let params = new URLSearchParams({
            access_token: this.accessToken,
            limit: opts.limit.toString(),
            types: opts.types
        });

        if (opts.country) params.append('country', opts.country);
        if (opts.proximity) params.append('proximity', opts.proximity.join(','));
        url = `${url}?${params.toString()}`;

        try {
            return await this.proxyRequest(url);
        } catch (error) {
            console.error('Forward geocoding error:', error);
            throw error;
        }
    }

    /**
     * Reverse geocode coordinates to a place name
     */
    async reverseGeocode(lngLat: number[], options: any = {}): Promise<any> {
        if (!lngLat || lngLat.length !== 2) throw new Error('Valid coordinates required');

        const defaults = { types: 'address,poi,place' };
        const opts = { ...defaults, ...options };

        let url = `${this.proxyBaseUrl}/geocoding/v5/mapbox.places/${lngLat[0]},${lngLat[1]}.json`;
        let params = new URLSearchParams({
            access_token: this.accessToken,
            types: opts.types
        });

        if (opts.limit) params.append('limit', opts.limit.toString());
        url = `${url}?${params.toString()}`;

        try {
            return await this.proxyRequest(url);
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            throw error;
        }
    }

    /**
     * Initialize Mapbox Directions control
     */
    async initializeNavigation(options: any = {}): Promise<any> {
        if (!this.map) throw new Error('Map not initialized');
        await this.loadMapboxServices();

        const defaults = {
            unit: 'metric',
            profile: 'mapbox/driving',
            alternatives: true,
            congestion: true,
            steps: true,
            controls: { inputs: true, instructions: true },
            position: 'top-left'
        };

        const opts = { ...defaults, ...options };

        this.directionsControl = new window.MapboxDirections({
            accessToken: this.accessToken,
            unit: opts.unit,
            profile: opts.profile,
            alternatives: opts.alternatives,
            congestion: opts.congestion,
            steps: opts.steps,
            controls: opts.controls
        });

        this.map.addControl(this.directionsControl, opts.position);
        return this.directionsControl;
    }

    /**
     * Get route between two points
     */
    async getRoute(origin: number[], destination: number[], options: RouteOptions = {}): Promise<any> {
        if (!origin || !destination) throw new Error('Origin and destination required');

        const defaults = {
            profile: 'driving',
            alternatives: false,
            steps: true,
            geometries: 'geojson',
            annotations: 'distance,duration,speed',
            overview: 'full'
        };

        const opts = { ...defaults, ...options };
        const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;

        let url = `${this.proxyBaseUrl}/directions/v5/mapbox/${opts.profile}/${coordinates}`;
        let params = new URLSearchParams({
            access_token: this.accessToken,
            alternatives: opts.alternatives.toString(),
            steps: opts.steps.toString(),
            geometries: opts.geometries,
            annotations: opts.annotations,
            overview: opts.overview
        });

        url = `${url}?${params.toString()}`;

        try {
            const data = await this.proxyRequest(url);

            if (this.map && data.routes?.length) {
                this.removeRoutes();

                data.routes.forEach((route: any, i: number) => {
                    const routeId = `route-${i}`;
                    const routeLineId = `route-line-${i}`;

                    this.map.addSource(routeId, {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            properties: {},
                            geometry: route.geometry
                        }
                    });

                    this.map.addLayer({
                        id: routeLineId,
                        type: 'line',
                        source: routeId,
                        layout: {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        paint: {
                            'line-color': i === 0 ? '#3887be' : '#ccc',
                            'line-width': i === 0 ? 5 : 3
                        }
                    });

                    this.routes.push({ sourceId: routeId, layerId: routeLineId });
                });

                const bounds = new window.mapboxgl.LngLatBounds();
                data.routes[0].geometry.coordinates.forEach((coord: number[]) => {
                    bounds.extend(coord);
                });

                this.map.fitBounds(bounds, { padding: 40 });

                this.clearMarkers();
                this.addMarker(origin, { color: '#3bb2d0' });
                this.addMarker(destination, { color: '#8a8acb' });
            }

            return data;
        } catch (error) {
            console.error('Route error:', error);
            throw error;
        }
    }

    /**
     * Remove all route layers from the map
     */
    removeRoutes(): void {
        if (!this.map) return;

        this.routes.forEach(route => {
            if (this.map.getLayer(route.layerId)) {
                this.map.removeLayer(route.layerId);
            }
            if (this.map.getSource(route.sourceId)) {
                this.map.removeSource(route.sourceId);
            }
        });

        this.routes = [];
    }

    /**
     * Get a distance matrix between multiple origins and destinations
     */
    async getMatrix(origins: number[][], destinations: number[][], options: any = {}): Promise<any> {
        if (!origins?.length || !destinations?.length) {
            throw new Error('Origins and destinations required');
        }

        if (origins.length * destinations.length > 25) {
            throw new Error('Maximum 25 coordinates (origins × destinations)');
        }

        const defaults = {
            profile: 'driving',
            annotations: ['duration', 'distance']
        };

        const opts = { ...defaults, ...options };
        const allCoords = [...origins, ...destinations];
        const coordsStr = allCoords.map(c => `${c[0]},${c[1]}`).join(';');
        const sources = Array.from({ length: origins.length }, (_, i) => i);
        const dests = Array.from({ length: destinations.length }, (_, i) => i + origins.length);

        let url = `${this.proxyBaseUrl}/directions-matrix/v1/mapbox/${opts.profile}/${coordsStr}`;
        let params = new URLSearchParams({
            access_token: this.accessToken,
            annotations: opts.annotations.join(','),
            sources: sources.join(';'),
            destinations: dests.join(';')
        });

        url = `${url}?${params.toString()}`;

        try {
            return await this.proxyRequest(url);
        } catch (error) {
            console.error('Matrix error:', error);
            throw error;
        }
    }

    /**
     * Get isochrone (time-based travel boundary) for a location
     */
    async getIsochrone(center: number[], contours: number[] = [5, 10, 15], options: any = {}): Promise<any> {
        if (!center || center.length !== 2) {
            throw new Error('Valid center coordinates required');
        }

        const defaults = {
            profile: 'walking',
            contours_colors: ['#6706ce', '#04e813', '#0070f3']
        };

        const opts = { ...defaults, ...options };
        let url = `${this.proxyBaseUrl}/isochrone/v1/mapbox/${opts.profile}/${center[0]},${center[1]}`;
        let params = new URLSearchParams({
            access_token: this.accessToken,
            contours_minutes: contours.join(',')
        });

        if (opts.contours_colors) params.append('contours_colors', opts.contours_colors.join(','));
        if (opts.polygons) params.append('polygons', opts.polygons.toString());

        url = `${url}?${params.toString()}`;

        try {
            const data = await this.proxyRequest(url);

            if (this.map && data.features?.length) {
                this.removeIsochroneLayers();

                for (let i = 0; i < data.features.length; i++) {
                    const feature = data.features[i];
                    const minutes = feature.properties.contour;
                    const sourceId = `iso-source-${minutes}`;
                    const layerId = `iso-layer-${minutes}`;

                    this.map.addSource(sourceId, {
                        type: 'geojson',
                        data: feature
                    });

                    this.map.addLayer({
                        id: layerId,
                        type: 'fill',
                        source: sourceId,
                        layout: {},
                        paint: {
                            'fill-color': opts.contours_colors[i] || '#6706ce',
                            'fill-opacity': 0.3
                        }
                    });

                    this.map.addLayer({
                        id: `${layerId}-outline`,
                        type: 'line',
                        source: sourceId,
                        layout: {},
                        paint: {
                            'line-color': opts.contours_colors[i] || '#6706ce',
                            'line-width': 3,
                            'line-opacity': 0.8
                        }
                    });

                    this.isochroneLayers.push({
                        sourceId,
                        layerId,
                        outlineLayerId: `${layerId}-outline`
                    });
                }

                this.addMarker(center, {
                    color: '#000',
                    popup: '<strong>Isochrone Center</strong>'
                });
            }

            return data;
        } catch (error) {
            console.error('Isochrone error:', error);
            throw error;
        }
    }

    /**
     * Remove isochrone layers from the map
     */
    removeIsochroneLayers(): void {
        if (!this.map || !this.isochroneLayers) return;

        this.isochroneLayers.forEach(layer => {
            if (this.map.getLayer(layer.layerId)) {
                this.map.removeLayer(layer.layerId);
            }
            if (this.map.getLayer(layer.outlineLayerId)) {
                this.map.removeLayer(layer.outlineLayerId);
            }
            if (this.map.getSource(layer.sourceId)) {
                this.map.removeSource(layer.sourceId);
            }
        });

        this.isochroneLayers = [];
    }

    /**
     * Add a generic layer to the map
     */
    addLayer(id: string, source: any, layerOptions: any): any {
        if (!this.map) throw new Error('Map not initialized');

        if (!this.map.getSource(id)) {
            this.map.addSource(id, source);
        }

        if (!this.map.getLayer(id)) {
            this.map.addLayer({
                id: id,
                source: id,
                ...layerOptions
            });
        }

        return this.map;
    }

    /**
     * Create a heatmap visualization
     */
    createHeatmap(id: string, data: any, options: any = {}): any {
        const defaults = {
            maxzoom: 15,
            weight: ['get', 'weight'],
            intensity: 1,
            radius: 20,
            opacity: 0.8,
            colorRange: [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(33,102,172,0)',
                0.2, 'rgb(103,169,207)',
                0.4, 'rgb(209,229,240)',
                0.6, 'rgb(253,219,199)',
                0.8, 'rgb(239,138,98)',
                1, 'rgb(178,24,43)'
            ]
        };

        const opts = { ...defaults, ...options };

        return this.addLayer(id, {
            type: 'geojson',
            data: data
        }, {
            type: 'heatmap',
            paint: {
                'heatmap-weight': opts.weight,
                'heatmap-intensity': opts.intensity,
                'heatmap-color': opts.colorRange,
                'heatmap-radius': opts.radius,
                'heatmap-opacity': opts.opacity
            },
            maxzoom: opts.maxzoom
        });
    }

    /**
     * Create a cluster visualization
     */
    createClusterLayer(id: string, data: any, options: any = {}): any {
        if (!this.map) throw new Error('Map not initialized');

        const defaults = {
            clusterMaxZoom: 14,
            clusterRadius: 50,
            clusterColors: ['#51bbd6', '#f1f075', '#f28cb1']
        };

        const opts = { ...defaults, ...options };

        this.map.addSource(id, {
            type: 'geojson',
            data: data,
            cluster: true,
            clusterMaxZoom: opts.clusterMaxZoom,
            clusterRadius: opts.clusterRadius
        });

        this.map.addLayer({
            id: `${id}-clusters`,
            type: 'circle',
            source: id,
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': [
                    'step',
                    ['get', 'point_count'],
                    opts.clusterColors[0],
                    20, opts.clusterColors[1],
                    100, opts.clusterColors[2]
                ],
                'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    20,
                    100, 30,
                    750, 40
                ]
            }
        });

        this.map.addLayer({
            id: `${id}-cluster-count`,
            type: 'symbol',
            source: id,
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12
            }
        });

        this.map.addLayer({
            id: `${id}-unclustered-point`,
            type: 'circle',
            source: id,
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': '#11b4da',
                'circle-radius': 6,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        return this.map;
    }

    /**
     * Add 3D terrain to the map
     */
    add3DTerrain(exaggeration: number = 1.5): void {
        if (!this.map) throw new Error('Map not initialized');

        if (!this.map.getSource('mapbox-dem')) {
            this.map.addSource('mapbox-dem', {
                'type': 'raster-dem',
                'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                'tileSize': 512,
                'maxzoom': 14
            });
        }
        this.map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': exaggeration });

        if (!this.map.getLayer('sky')) {
            this.map.addLayer({
                'id': 'sky',
                'type': 'sky',
                'paint': {
                    'sky-type': 'atmosphere',
                    'sky-atmosphere-sun': [0.0, 0.0],
                    'sky-atmosphere-sun-intensity': 15
                }
            });
        }
    }
}