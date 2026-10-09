import { normalizePlateNumber } from './cryptoService';
import { dbService } from './dbService';
import { visitService } from './visitService';
import type { Booking, Visit } from '../types';

export interface ANPRResult {
  rawText: string;
  normalizedPlate: string;
  confidence: number; // 0 - 100
  timestamp: string;
  frameDataUrl?: string;
  isSimulated: boolean;
  matchedBooking?: Booking;
  matchStatus: 'matched' | 'no_active_booking' | 'plate_mismatch' | 'low_confidence';
}

export class ANPRService {
  /**
   * Sample plates for simulation mode to easily test various test scenarios:
   * - Valid reserved booking (KA 01 AB 1234)
   * - Already inside (DL 03 C 9988)
   * - Unknown vehicle / unreserved (MH 12 CD 5678)
   * - Blurred / low confidence (TN 09 XY 9999)
   */
  public getSimulationPresets(): { label: string; plate: string; confidence: number; note: string }[] {
    return [
      {
        label: 'KA 01 AB 1234 (Customer 1 - Reserved)',
        plate: 'KA 01 AB 1234',
        confidence: 96,
        note: 'Matches active reservation for Bay A-101'
      },
      {
        label: 'DL 03 C 9988 (Customer 2 - Already Inside)',
        plate: 'DL 03 C 9988',
        confidence: 94,
        note: 'Vehicle already active inside facility at Bay A-103'
      },
      {
        label: 'MH 12 CD 5678 (Unregistered Visitor)',
        plate: 'MH 12 CD 5678',
        confidence: 91,
        note: 'No active reservation found for this plate'
      },
      {
        label: 'TN 07 BQ 3456 (Low Confidence / Dirty Plate)',
        plate: 'TN 07 BQ 3456',
        confidence: 58,
        note: 'Confidence score below 75% threshold — requires manual inspection'
      }
    ];
  }

  /**
   * Evaluates an optical plate recognition result against active facility bookings.
   */
  public processRecognition(params: {
    rawPlate: string;
    confidence: number;
    parkingAreaId: string;
    frameDataUrl?: string;
    isSimulated?: boolean;
  }): ANPRResult {
    const { display, normalized, isValid } = normalizePlateNumber(params.rawPlate);
    const now = new Date().toISOString();

    if (!isValid || params.confidence < 70) {
      return {
        rawText: params.rawPlate,
        normalizedPlate: normalized,
        confidence: params.confidence,
        timestamp: now,
        frameDataUrl: params.frameDataUrl,
        isSimulated: params.isSimulated !== false,
        matchStatus: 'low_confidence'
      };
    }

    // Search active reservations for this facility
    const bookings = dbService.getBookings(undefined, params.parkingAreaId);
    const matched = bookings.find(
      b => b.vehiclePlateNormalized === normalized && b.status === 'reserved'
    );

    if (matched) {
      return {
        rawText: display,
        normalizedPlate: normalized,
        confidence: params.confidence,
        timestamp: now,
        frameDataUrl: params.frameDataUrl,
        isSimulated: params.isSimulated !== false,
        matchedBooking: matched,
        matchStatus: 'matched'
      };
    }

    return {
      rawText: display,
      normalizedPlate: normalized,
      confidence: params.confidence,
      timestamp: now,
      frameDataUrl: params.frameDataUrl,
      isSimulated: params.isSimulated !== false,
      matchStatus: 'no_active_booking'
    };
  }

  /**
   * Authorizes entry based on matched ANPR result.
   */
  public authorizeANPREntry(params: {
    bookingId: string;
    operatorId?: string;
  }): { success: boolean; visit?: Visit; error?: string } {
    return visitService.startVisit({
      bookingId: params.bookingId,
      entryMethod: 'anpr_camera',
      operatorId: params.operatorId
    });
  }
}

export const anprService = new ANPRService();
