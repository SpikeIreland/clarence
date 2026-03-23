declare module 'react-simple-maps' {
    import { ComponentType, SVGProps, ReactNode, CSSProperties } from 'react'

    interface ComposableMapProps {
        projection?: string
        projectionConfig?: { scale?: number; center?: [number, number]; rotate?: [number, number, number] }
        width?: number
        height?: number
        style?: CSSProperties
        children?: ReactNode
    }
    export const ComposableMap: ComponentType<ComposableMapProps>

    interface GeographiesProps {
        geography: string | object
        children: (props: { geographies: GeoFeature[] }) => ReactNode
    }
    export interface GeoFeature {
        rsmKey: string
        [key: string]: unknown
    }
    export const Geographies: ComponentType<GeographiesProps>

    interface GeographyProps extends SVGProps<SVGPathElement> {
        geography: GeoFeature
    }
    export const Geography: ComponentType<GeographyProps>

    interface MarkerProps {
        coordinates: [number, number]
        children?: ReactNode
    }
    export const Marker: ComponentType<MarkerProps>

    interface LineProps extends SVGProps<SVGLineElement> {
        from: [number, number]
        to: [number, number]
        strokeLinecap?: string
    }
    export const Line: ComponentType<LineProps>
}
