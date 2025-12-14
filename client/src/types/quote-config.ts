export type ListingStrategy = 'by_room' | 'by_surface';

export type CostPlacement = 'inline' | 'subline' | 'separate_area';

export interface ViewDetails {
    showName: boolean;
    showVolume?: boolean; // Paint only
    showCoats?: boolean; // Paint only
    showQuantity?: boolean; // Materials only
    showPrice: boolean;
}

export type PrimerStrategy = 'separate_line' | 'combined' | 'none';

export type MaterialStrategy = 'itemized' | 'group_total';

export type PrepPlacement = 'inline' | 'subline' | 'separate_area';

export type LaborUnit = 'geometric' | 'hourly' | 'lump_sum';

export interface QuoteConfiguration {
    // Step 1: Listing Strategy
    listingStrategy: ListingStrategy;
    activityPrepStrategy?: 'separate_section' | 'combined_labor';

    // Step 2: Paint Costs
    paintPlacement: CostPlacement;
    paintDetails: ViewDetails;
    primerStrategy: PrimerStrategy;

    // Step 3: Material Costs
    materialPlacement: CostPlacement;
    materialDetails: ViewDetails;
    materialStrategy: MaterialStrategy;

    // Step 3.5: Separate Area Grouping
    separateAreaStrategy: 'combined' | 'separate'; // Only if both paint & materials are separate_area

    // Step 4: Prep Work Costs
    prepPlacement: PrepPlacement;
    prepStrategy: MaterialStrategy; // Itemized vs Group Total

    // Step 5: Labor Pricing
    laborUnit: LaborUnit;

    // Step 6: Fine Tuning
    showUnits: boolean;
    showRates: boolean;

    showTaxLine: boolean;
    showDisclaimers: boolean;

}

export const DEFAULT_QUOTE_CONFIG: QuoteConfiguration = {
    listingStrategy: 'by_room',
    activityPrepStrategy: 'separate_section',
    paintPlacement: 'subline',
    paintDetails: { showName: true, showVolume: true, showCoats: true, showPrice: true },
    primerStrategy: 'separate_line',
    materialPlacement: 'subline',
    materialDetails: { showName: true, showQuantity: true, showPrice: true },
    materialStrategy: 'itemized',
    separateAreaStrategy: 'combined',
    prepPlacement: 'subline',
    prepStrategy: 'itemized',
    laborUnit: 'geometric',
    showUnits: true,
    showRates: true,

    showTaxLine: true,
    showDisclaimers: true,

};
