declare module 'edmonds-blossom-fixed' {
    /**
     * Edmonds' weighted maximum matching (blossom algorithm).
     *
     * @param edges list of `[vertexA, vertexB, weight]` triples
     * @param maxCardinality when true, maximize the number of matched vertices first
     * @returns for each vertex index, the index of the vertex it is matched with, or -1 when unmatched
     */
    export default function blossom(edges: number[][], maxCardinality?: boolean): number[];
}
