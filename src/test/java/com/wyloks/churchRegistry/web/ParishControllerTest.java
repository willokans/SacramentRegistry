package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyloks.churchRegistry.dto.ParishMarriageRequirementsPatchRequest;
import com.wyloks.churchRegistry.dto.ParishMarriageRequirementsResponse;
import com.wyloks.churchRegistry.dto.ParishRequest;
import com.wyloks.churchRegistry.dto.ParishResponse;
import com.wyloks.churchRegistry.security.SacramentAuthorizationService;
import com.wyloks.churchRegistry.service.ParishService;
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

import com.wyloks.churchRegistry.config.TestSecurityConfig;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = ParishController.class)
@EnableAutoConfiguration(exclude = SecurityAutoConfiguration.class)
@Import(TestSecurityConfig.class)
@ActiveProfiles("auth-slice")
class ParishControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    ParishService parishService;

    @MockBean
    SacramentAuthorizationService sacramentAuthorizationService;

    @Test
    void createParish_returns201AndBody_whenValid() throws Exception {
        ParishRequest request = new ParishRequest("St Mary", 1L, "Main parish");
        ParishResponse response = new ParishResponse(1L, "St Mary", 1L, "Main parish", true);

        when(parishService.create(any(ParishRequest.class))).thenReturn(response);

        mvc.perform(post("/api/parishes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.parishName").value("St Mary"))
                .andExpect(jsonPath("$.dioceseId").value(1))
                .andExpect(jsonPath("$.requireMarriageConfirmation").value(true));
    }

    @Test
    void getParishById_returns200_whenExists() throws Exception {
        ParishResponse response = new ParishResponse(1L, "St Mary", 1L, null, true);
        when(parishService.findById(1L)).thenReturn(java.util.Optional.of(response));

        mvc.perform(get("/api/parishes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.parishName").value("St Mary"))
                .andExpect(jsonPath("$.requireMarriageConfirmation").value(true));

        verify(sacramentAuthorizationService).requireParishAccess(1L);
    }

    @Test
    void getParishById_returns404_whenNotExists() throws Exception {
        when(parishService.findById(999L)).thenReturn(java.util.Optional.empty());

        mvc.perform(get("/api/parishes/999"))
                .andExpect(status().isNotFound());

        verify(sacramentAuthorizationService).requireParishAccess(999L);
    }

    @Test
    void getMarriageRequirements_returns200_whenParishExists() throws Exception {
        ParishMarriageRequirementsResponse body = new ParishMarriageRequirementsResponse(1L, true);
        when(parishService.getMarriageRequirements(1L)).thenReturn(Optional.of(body));

        mvc.perform(get("/api/parishes/1/marriage-requirements"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parishId").value(1))
                .andExpect(jsonPath("$.requireMarriageConfirmation").value(true));

        verify(sacramentAuthorizationService).requireParishAccess(1L);
    }

    @Test
    void getMarriageRequirements_returns404_whenParishMissing() throws Exception {
        when(parishService.getMarriageRequirements(999L)).thenReturn(Optional.empty());

        mvc.perform(get("/api/parishes/999/marriage-requirements"))
                .andExpect(status().isNotFound());

        verify(sacramentAuthorizationService).requireParishAccess(999L);
    }

    @Test
    void patchMarriageRequirements_returns200_andBody() throws Exception {
        ParishMarriageRequirementsResponse updated = new ParishMarriageRequirementsResponse(2L, false);
        when(parishService.updateMarriageRequirements(eq(2L), eq(false))).thenReturn(updated);

        ParishMarriageRequirementsPatchRequest patchBody = ParishMarriageRequirementsPatchRequest.builder()
                .requireMarriageConfirmation(false)
                .build();

        mvc.perform(patch("/api/parishes/2/marriage-requirements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(patchBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parishId").value(2))
                .andExpect(jsonPath("$.requireMarriageConfirmation").value(false));

        verify(sacramentAuthorizationService).requireAdminRole();
        verify(sacramentAuthorizationService).requireParishAccess(2L);
    }

    @Test
    void patchMarriageRequirements_returns404_whenUpdateThrowsIllegalArgument() throws Exception {
        when(parishService.updateMarriageRequirements(eq(3L), eq(true)))
                .thenThrow(new IllegalArgumentException("Parish not found: 3"));

        ParishMarriageRequirementsPatchRequest patchBody = ParishMarriageRequirementsPatchRequest.builder()
                .requireMarriageConfirmation(true)
                .build();

        mvc.perform(patch("/api/parishes/3/marriage-requirements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(patchBody)))
                .andExpect(status().isNotFound());
    }

    @Test
    void patchMarriageRequirements_returns400_whenBodyMissingFlag() throws Exception {
        mvc.perform(patch("/api/parishes/1/marriage-requirements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }
}
