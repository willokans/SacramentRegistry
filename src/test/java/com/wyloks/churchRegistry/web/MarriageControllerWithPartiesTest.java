package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.wyloks.churchRegistry.dto.CreateMarriageWithPartiesRequest;
import com.wyloks.churchRegistry.dto.MarriagePartyResponse;
import com.wyloks.churchRegistry.dto.MarriageResponse;
import com.wyloks.churchRegistry.dto.MarriageWitnessResponse;
import com.wyloks.churchRegistry.dto.ParishResponse;
import com.wyloks.churchRegistry.security.SacramentAuthorizationService;
import com.wyloks.churchRegistry.service.MarriageService;
import com.wyloks.churchRegistry.service.ParishService;
import com.wyloks.churchRegistry.service.SacramentAuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wyloks.churchRegistry.config.TestSecurityConfig;

@WebMvcTest(controllers = MarriageController.class)
@EnableAutoConfiguration(exclude = SecurityAutoConfiguration.class)
@Import(TestSecurityConfig.class)
@ActiveProfiles("auth-slice")
class MarriageControllerWithPartiesTest {

    @Autowired
    MockMvc mvc;

    ObjectMapper objectMapper;

    @MockBean
    MarriageService marriageService;

    @MockBean
    ParishService parishService;

    @MockBean
    SacramentAuthorizationService sacramentAuthorizationService;

    @MockBean
    SacramentAuditService sacramentAuditService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Test
    void createWithParties_returns201_andResponseBody() throws Exception {
        CreateMarriageWithPartiesRequest request = CreateMarriageWithPartiesRequest.builder()
                .marriage(CreateMarriageWithPartiesRequest.MarriageDetails.builder()
                        .partnersName("Lewis Hamilton & Jessica Uche")
                        .parishId(1L)
                        .marriageDate(LocalDate.of(2025, 6, 15))
                        .marriageTime(null)
                        .churchName("Holy Family Catholic Church")
                        .marriageRegister("Book 2")
                        .diocese("Abuja Diocese")
                        .civilRegistryNumber("MAR-HFCA-2026-0000077")
                        .dispensationGranted(false)
                        .canonicalNotes("Freedom to marry confirmed")
                        .officiatingPriest("Fr. Rahp Okamunsch")
                        .parish("Life Camp, Abuja")
                        .build())
                .groom(CreateMarriageWithPartiesRequest.PartyDetails.builder()
                        .fullName("Lewis Josh Hamilton")
                        .confirmationId(101)
                        .build())
                .bride(CreateMarriageWithPartiesRequest.PartyDetails.builder()
                        .fullName("Jessica Lynn Uche")
                        .confirmationId(101)
                        .build())
                .witnesses(List.of(
                        CreateMarriageWithPartiesRequest.WitnessDetails.builder()
                                .fullName("Witness One")
                                .phone(null)
                                .address(null)
                                .sortOrder(0)
                                .build(),
                        CreateMarriageWithPartiesRequest.WitnessDetails.builder()
                                .fullName("Witness Two")
                                .phone(null)
                                .address(null)
                                .sortOrder(1)
                                .build()
                ))
                .build();

        MarriagePartyResponse groomParty = MarriagePartyResponse.builder()
                .role("GROOM")
                .fullName("Lewis Josh Hamilton")
                .confirmationId(101L)
                .build();
        MarriagePartyResponse brideParty = MarriagePartyResponse.builder()
                .role("BRIDE")
                .fullName("Jessica Lynn Uche")
                .confirmationId(101L)
                .build();
        MarriageWitnessResponse w1 = MarriageWitnessResponse.builder().fullName("Witness One").sortOrder(0).build();
        MarriageWitnessResponse w2 = MarriageWitnessResponse.builder().fullName("Witness Two").sortOrder(1).build();

        MarriageResponse response = MarriageResponse.builder()
                .id(55L)
                .confirmationId(101L)
                .partnersName("Lewis Hamilton & Jessica Uche")
                .marriageDate(LocalDate.of(2025, 6, 15))
                .officiatingPriest("Fr. Rahp Okamunsch")
                .parish("Life Camp, Abuja")
                .parties(List.of(groomParty, brideParty))
                .witnesses(List.of(w1, w2))
                .build();

        when(marriageService.createWithParties(any(CreateMarriageWithPartiesRequest.class))).thenReturn(response);
        when(sacramentAuthorizationService.requireWriteAccessForExistingConfirmation(101L)).thenReturn(1L);
        doNothing().when(sacramentAuthorizationService).requireWriteAccessForParish(1L);
        when(parishService.findById(anyLong())).thenReturn(Optional.of(
                ParishResponse.builder()
                        .id(1L)
                        .parishName("Life Camp, Abuja")
                        .dioceseId(1L)
                        .requireMarriageConfirmation(true)
                        .build()));

        mvc.perform(post("/api/marriages/with-parties")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(55))
                .andExpect(jsonPath("$.confirmationId").value(101))
                .andExpect(jsonPath("$.partnersName").value("Lewis Hamilton & Jessica Uche"))
                .andExpect(jsonPath("$.parties[0].fullName").value("Lewis Josh Hamilton"))
                .andExpect(jsonPath("$.witnesses[1].fullName").value("Witness Two"));
    }

    @Test
    void createWithParties_returns201_whenParishDoesNotRequireConfirmation_andNoConfirmationIds() throws Exception {
        CreateMarriageWithPartiesRequest request = CreateMarriageWithPartiesRequest.builder()
                .marriage(CreateMarriageWithPartiesRequest.MarriageDetails.builder()
                        .partnersName("A & B")
                        .parishId(1L)
                        .marriageDate(LocalDate.of(2025, 6, 15))
                        .churchName("St. Mary")
                        .officiatingPriest("Fr. X")
                        .parish("Parish Name")
                        .build())
                .groom(CreateMarriageWithPartiesRequest.PartyDetails.builder()
                        .fullName("Party A")
                        .baptismId(10)
                        .communionId(20)
                        .build())
                .bride(CreateMarriageWithPartiesRequest.PartyDetails.builder()
                        .fullName("Party B")
                        .baptismId(11)
                        .communionId(21)
                        .build())
                .witnesses(List.of(
                        CreateMarriageWithPartiesRequest.WitnessDetails.builder()
                                .fullName("Witness One")
                                .sortOrder(0)
                                .build()
                ))
                .build();

        MarriagePartyResponse groomParty = MarriagePartyResponse.builder()
                .role("GROOM")
                .fullName("Party A")
                .baptismId(10L)
                .communionId(20L)
                .build();
        MarriagePartyResponse brideParty = MarriagePartyResponse.builder()
                .role("BRIDE")
                .fullName("Party B")
                .baptismId(11L)
                .communionId(21L)
                .build();

        MarriageResponse response = MarriageResponse.builder()
                .id(77L)
                .confirmationId(null)
                .baptismId(10L)
                .communionId(20L)
                .partnersName("A & B")
                .marriageDate(LocalDate.of(2025, 6, 15))
                .officiatingPriest("Fr. X")
                .parish("Parish Name")
                .parties(List.of(groomParty, brideParty))
                .witnesses(List.of())
                .build();

        when(marriageService.createWithParties(any(CreateMarriageWithPartiesRequest.class))).thenReturn(response);
        when(parishService.findById(anyLong())).thenReturn(Optional.of(
                ParishResponse.builder()
                        .id(1L)
                        .parishName("Parish Name")
                        .dioceseId(1L)
                        .requireMarriageConfirmation(false)
                        .build()));

        mvc.perform(post("/api/marriages/with-parties")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(77))
                .andExpect(jsonPath("$.confirmationId").value(nullValue()));

        verify(sacramentAuthorizationService, never()).requireWriteAccessForExistingConfirmation(anyLong());
    }

    @Test
    void createWithParties_returns400_whenParishNotFound() throws Exception {
        CreateMarriageWithPartiesRequest request = minimalValidWithPartiesRequest();
        when(parishService.findById(1L)).thenReturn(Optional.empty());

        mvc.perform(post("/api/marriages/with-parties")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(marriageService);
    }

    @Test
    void createWithParties_returns400_whenParishRequiresConfirmation_butPartiesDoNotDocumentConfirmation() throws Exception {
        CreateMarriageWithPartiesRequest base = minimalValidWithPartiesRequest();
        CreateMarriageWithPartiesRequest request = CreateMarriageWithPartiesRequest.builder()
                .marriage(base.getMarriage())
                .groom(CreateMarriageWithPartiesRequest.PartyDetails.builder().fullName("Party A").build())
                .bride(CreateMarriageWithPartiesRequest.PartyDetails.builder().fullName("Party B").build())
                .witnesses(base.getWitnesses())
                .build();

        when(parishService.findById(1L)).thenReturn(Optional.of(
                ParishResponse.builder()
                        .id(1L)
                        .parishName("Parish Name")
                        .dioceseId(1L)
                        .requireMarriageConfirmation(true)
                        .build()));

        mvc.perform(post("/api/marriages/with-parties")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(marriageService, never()).createWithParties(any());
    }

    @Test
    void createWithParties_returns400_whenParishRequiresConfirmation_butOnlyExternalCertificatesNoParishRecord() throws Exception {
        CreateMarriageWithPartiesRequest base = minimalValidWithPartiesRequest();
        CreateMarriageWithPartiesRequest request = CreateMarriageWithPartiesRequest.builder()
                .marriage(base.getMarriage())
                .groom(CreateMarriageWithPartiesRequest.PartyDetails.builder()
                        .fullName("Party A")
                        .confirmationCertificatePath("/certs/groom.pdf")
                        .build())
                .bride(CreateMarriageWithPartiesRequest.PartyDetails.builder()
                        .fullName("Party B")
                        .confirmationCertificatePath("/certs/bride.pdf")
                        .build())
                .witnesses(base.getWitnesses())
                .build();

        when(parishService.findById(1L)).thenReturn(Optional.of(
                ParishResponse.builder()
                        .id(1L)
                        .parishName("Parish Name")
                        .dioceseId(1L)
                        .requireMarriageConfirmation(true)
                        .build()));

        mvc.perform(post("/api/marriages/with-parties")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verify(marriageService, never()).createWithParties(any());
    }

    @Test
    void createWithParties_returns400_whenMarriageParishIdMissing() throws Exception {
        CreateMarriageWithPartiesRequest request = CreateMarriageWithPartiesRequest.builder()
                .marriage(CreateMarriageWithPartiesRequest.MarriageDetails.builder()
                        .partnersName("A & B")
                        .parishId(null)
                        .marriageDate(LocalDate.of(2025, 6, 15))
                        .churchName("St. Mary")
                        .officiatingPriest("Fr. X")
                        .parish("Parish Name")
                        .build())
                .groom(CreateMarriageWithPartiesRequest.PartyDetails.builder().fullName("G").confirmationId(101).build())
                .bride(CreateMarriageWithPartiesRequest.PartyDetails.builder().fullName("B").confirmationId(101).build())
                .witnesses(List.of(
                        CreateMarriageWithPartiesRequest.WitnessDetails.builder().fullName("W1").sortOrder(0).build(),
                        CreateMarriageWithPartiesRequest.WitnessDetails.builder().fullName("W2").sortOrder(1).build()
                ))
                .build();

        mvc.perform(post("/api/marriages/with-parties")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(marriageService);
        verifyNoInteractions(parishService);
    }

    @Test
    void createWithParties_returns400_whenRequiredNestedFieldsMissing() throws Exception {
        CreateMarriageWithPartiesRequest request = CreateMarriageWithPartiesRequest.builder()
                .marriage(CreateMarriageWithPartiesRequest.MarriageDetails.builder()
                        .partnersName("Lewis Hamilton & Jessica Uche")
                        .parishId(1L)
                        .marriageDate(LocalDate.of(2025, 6, 15))
                        .churchName("Holy Family Catholic Church")
                        // Missing required: officiatingPriest and parish
                        .officiatingPriest("")
                        .parish("")
                        .build())
                .groom(CreateMarriageWithPartiesRequest.PartyDetails.builder()
                        .fullName("Lewis Josh Hamilton")
                        .confirmationId(101)
                        .build())
                .bride(CreateMarriageWithPartiesRequest.PartyDetails.builder()
                        .fullName("Jessica Lynn Uche")
                        .confirmationId(101)
                        .build())
                .witnesses(List.of(
                        CreateMarriageWithPartiesRequest.WitnessDetails.builder()
                                .fullName("Witness One")
                                .sortOrder(0)
                                .build()
                ))
                .build();

        mvc.perform(post("/api/marriages/with-parties")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    /** Valid JSON body for authorization-layer tests (passes bean validation). */
    private static CreateMarriageWithPartiesRequest minimalValidWithPartiesRequest() {
        return CreateMarriageWithPartiesRequest.builder()
                .marriage(CreateMarriageWithPartiesRequest.MarriageDetails.builder()
                        .partnersName("A & B")
                        .parishId(1L)
                        .marriageDate(LocalDate.of(2025, 6, 15))
                        .churchName("St. Mary")
                        .officiatingPriest("Fr. X")
                        .parish("Parish Name")
                        .build())
                .groom(CreateMarriageWithPartiesRequest.PartyDetails.builder()
                        .fullName("Party A")
                        .baptismId(10)
                        .communionId(20)
                        .build())
                .bride(CreateMarriageWithPartiesRequest.PartyDetails.builder()
                        .fullName("Party B")
                        .baptismId(11)
                        .communionId(21)
                        .build())
                .witnesses(List.of(
                        CreateMarriageWithPartiesRequest.WitnessDetails.builder()
                                .fullName("Witness One")
                                .sortOrder(0)
                                .build(),
                        CreateMarriageWithPartiesRequest.WitnessDetails.builder()
                                .fullName("Witness Two")
                                .sortOrder(1)
                                .build()
                ))
                .build();
    }
}

