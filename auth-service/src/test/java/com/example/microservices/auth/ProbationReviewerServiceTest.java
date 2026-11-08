package com.example.microservices.auth;

import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.example.microservices.auth.entity.*;
import com.example.microservices.auth.repository.UserRepository;
import com.example.microservices.auth.service.ProbationReviewerService;
import com.example.microservices.auth.exception.UserNotFoundException;

class ProbationReviewerServiceTest {
    @Test void directoryExposesOnlyTheAssignmentContract() {
        var repo=mock(UserRepository.class); var user=new User(); user.setId(9L); user.setEmployeeId(20L);
        user.setUsername("reviewer"); user.setPassword("must-not-leak"); user.setEmail("private@example.invalid");
        user.setRoles(Set.of(new Role("ROLE_EMPLOYEE"))); when(repo.findById(9L)).thenReturn(Optional.of(user));
        var result=new ProbationReviewerService(repo).get(9L);
        assertEquals(9L,result.id()); assertEquals(20L,result.employeeId());
        assertEquals(4,result.getClass().getRecordComponents().length);
    }
    @Test void disabledUnlinkedOrOfficeOnlyAccountsAreNotEligible() {
        var repo=mock(UserRepository.class); var user=new User(); user.setId(9L); user.setEmployeeId(20L);
        user.setRoles(Set.of(new Role("ROLE_EMPLOYEE"))); user.setEnabled(false);
        when(repo.findById(9L)).thenReturn(Optional.of(user)); var service=new ProbationReviewerService(repo);
        assertThrows(UserNotFoundException.class,()->service.get(9L));
        user.setEnabled(true); user.setEmployeeId(null); assertThrows(UserNotFoundException.class,()->service.get(9L));
        user.setEmployeeId(20L); user.setRoles(Set.of(new Role("ROLE_HR"))); assertThrows(UserNotFoundException.class,()->service.get(9L));
    }
}
